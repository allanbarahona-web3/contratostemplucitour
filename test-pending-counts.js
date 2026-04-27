// Test rápido para verificar pending-counts desde consola del navegador
console.log("Testeando pending-counts...");
fetch("http://localhost:3001/billing/admin/pending-counts", {
  headers: {
    "Authorization": `Bearer ${localStorage.getItem("auth_token")}`,
  }
})
.then(r => r.json())
.then(data => console.log("Pending counts:", data))
.catch(err => console.error("Error:", err));
