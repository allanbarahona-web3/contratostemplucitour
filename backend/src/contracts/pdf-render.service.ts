import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";

const CSS_PX_TO_PT = 0.75 as const; // 96 DPI → 72 DPI
const A4_HEIGHT_PX = 841.89 / CSS_PX_TO_PT; // ≈ 1122.52 CSS px per page
const A4_HEIGHT_PT = 841.89;

export interface SignatureAnchor {
  pageIndex: number;
  box: { x: number; y: number; width: number; height: number };
}

@Injectable()
export class PdfRenderService {
  private readonly logger = new Logger(PdfRenderService.name);

  async renderContractToBuffer(standaloneHtml: string): Promise<{
    pdfBuffer: Buffer;
    signatureAnchors: Record<string, SignatureAnchor>;
  }> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const puppeteer = require("puppeteer-core") as {
      launch: (opts: Record<string, unknown>) => Promise<{
        newPage: () => Promise<{
          setViewport: (opts: Record<string, unknown>) => Promise<void>;
          setContent: (html: string, opts: Record<string, unknown>) => Promise<void>;
          emulateMediaType: (type: string) => Promise<void>;
          evaluate: <T>(fn: (...args: unknown[]) => T, ...args: unknown[]) => Promise<T>;
          pdf: (opts: Record<string, unknown>) => Promise<Uint8Array>;
        }>;
        close: () => Promise<void>;
      }>;
    };

    const executablePath =
      process.env["PUPPETEER_EXECUTABLE_PATH"] ?? "/usr/bin/chromium";
    const disableSandbox = process.env["PUPPETEER_DISABLE_SANDBOX"] === "true";

    this.logger.log(`[pdf] executablePath=${executablePath} disableSandbox=${disableSandbox}`);

    const args = [
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
    ];
    if (disableSandbox) {
      args.push("--no-sandbox", "--disable-setuid-sandbox");
    }

    this.logger.log(`[pdf] launching browser with args: ${args.join(" ")}`);

    const browser = await puppeteer.launch({
      executablePath,
      args,
      headless: true,
    });
    this.logger.log("[pdf] browser launched");

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 794, height: 1123 });
      this.logger.log("[pdf] setContent start");
      await page.setContent(standaloneHtml, { waitUntil: "networkidle0", timeout: 30_000 });
      this.logger.log("[pdf] setContent done, emulating print");
      await page.emulateMediaType("print");

      const signatureAnchors = await page.evaluate(
        (a4HeightPx: unknown, a4HeightPt: unknown, pxToPt: unknown): Record<string, SignatureAnchor> => {
          const elems = document.querySelectorAll<HTMLElement>(
            "[data-signer-key]",
          );
          const anchors: Record<string, SignatureAnchor> = {};
          elems.forEach((el) => {
            const signerKey = el.getAttribute("data-signer-key");
            if (!signerKey) return;
            const rect = el.getBoundingClientRect();
            const pageIndex = Math.floor(rect.top / (a4HeightPx as number));
            const yLocal = rect.top - pageIndex * (a4HeightPx as number);
            anchors[signerKey] = {
              pageIndex,
              box: {
                x: Number((rect.left * (pxToPt as number)).toFixed(2)),
                y: Number(
                  ((a4HeightPt as number) - (yLocal + rect.height) * (pxToPt as number)).toFixed(2),
                ),
                width: Number((rect.width * (pxToPt as number)).toFixed(2)),
                height: Number((rect.height * (pxToPt as number)).toFixed(2)),
              },
            };
          });
          return anchors;
        },
        A4_HEIGHT_PX,
        A4_HEIGHT_PT,
        CSS_PX_TO_PT,
      );

      const pdfBytes = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
      });
      this.logger.log(`[pdf] pdf generated, size=${pdfBytes.length} bytes`);

      return {
        pdfBuffer: Buffer.from(pdfBytes),
        signatureAnchors: signatureAnchors as Record<string, SignatureAnchor>,
      };
    } catch (error) {
      this.logger.error("[pdf] render failed", error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException("No se pudo generar el PDF del contrato.");
    } finally {
      await browser.close();
      this.logger.log("[pdf] browser closed");
    }
  }
}
