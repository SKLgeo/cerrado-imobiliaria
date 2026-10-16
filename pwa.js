// Link da imobiliária: registra o service worker (instalar na tela inicial e abrir mesmo com internet ruim).
if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => { navigator.serviceWorker.register("./sw.js").catch(() => {}); });
}
