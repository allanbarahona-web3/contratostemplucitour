import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';

export interface VisionExtractionResult {
  success: boolean;
  data?: {
    amount?: number;
    currency?: string;
    date?: string;
    reference?: string;
    originBank?: string;
    destinationBank?: string;
    destinationAccount?: string;
    payerName?: string;
    paymentCode?: string;
    notes?: string;
    confidence?: number;
  };
  rawResponse?: any;
  error?: string;
}

@Injectable()
export class OpenAiVisionService {
  private readonly logger = new Logger(OpenAiVisionService.name);
  private client: OpenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY no está configurada. El procesamiento de comprobantes no funcionará.');
    }

    this.client = new OpenAI({
      apiKey: apiKey || 'dummy-key',
    });
  }

  async extractPaymentDataFromImage(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<VisionExtractionResult> {
    try {
      const apiKey = this.configService.get<string>('OPENAI_API_KEY');
      if (!apiKey) {
        return {
          success: false,
          error: 'OpenAI API key no configurada',
        };
      }

      // Convertir el buffer a base64
      const base64Image = imageBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Image}`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Eres un asistente experto en extraer datos de comprobantes bancarios de Costa Rica.
Debes analizar la imagen y extraer los siguientes datos en formato JSON:
- amount: monto transferido (número sin símbolos ni comas, solo dígitos y punto decimal)
- currency: moneda detectada según estas reglas:
  * Si ves el símbolo ₡ o dice "Colones" o "CRC" → currency debe ser "CRC"
  * Si ves el símbolo $ o dice "Dólares" o "USD" → currency debe ser "USD"
  * Si no hay símbolo claro, usa "CRC" como predeterminado para Costa Rica
- date: fecha de la transacción (formato ISO: YYYY-MM-DD)
- reference: número de referencia bancaria o número de comprobante
- originBank: nombre del banco desde donde se hizo el pago (ej: BAC, BCR, Promerica, Nacional, etc.)
- destinationBank: nombre del banco destino (si aparece)
- destinationAccount: número de cuenta o IBAN destino
- payerName: nombre de la persona o empresa que hizo el pago
- paymentCode: código único de pago que empiece con "LUC-" si lo encuentras en el detalle/motivo/concepto
- notes: resto del texto del detalle/motivo/concepto que no sea el código
- confidence: nivel de confianza de la extracción (0.0 a 1.0)

IMPORTANTE SOBRE MONEDA:
- Extrae el monto como número puro (ej: 50000.00, no "₡50,000.00")
- Identifica la moneda correctamente basándote en el símbolo o texto
- En Costa Rica, los símbolos son: ₡ para colones, $ para dólares
- NO asumas la moneda, debes buscar el símbolo en la imagen

Responde SOLO con el JSON, sin texto adicional.`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: dataUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        return {
          success: false,
          error: 'No se recibió respuesta de OpenAI',
        };
      }

      // Parse el JSON de la respuesta
      let extractedData: any;
      try {
        // Limpiar la respuesta por si viene con ```json
        const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
        extractedData = JSON.parse(cleanContent);
      } catch (parseError) {
        this.logger.error('Error parseando JSON de OpenAI:', content);
        return {
          success: false,
          error: 'Error parseando respuesta de OpenAI',
          rawResponse: content,
        };
      }

      return {
        success: true,
        data: {
          amount: extractedData.amount,
          currency: extractedData.currency,
          date: extractedData.date,
          reference: extractedData.reference,
          originBank: extractedData.originBank,
          destinationBank: extractedData.destinationBank,
          destinationAccount: extractedData.destinationAccount 
            ? String(extractedData.destinationAccount).replace(/[\s\-]/g, '').trim() 
            : undefined,
          payerName: extractedData.payerName,
          paymentCode: extractedData.paymentCode,
          notes: extractedData.notes,
          confidence: extractedData.confidence || 0.8,
        },
        rawResponse: extractedData,
      };

    } catch (error) {
      this.logger.error('Error en OpenAI Vision:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error procesando imagen',
      };
    }
  }
}
