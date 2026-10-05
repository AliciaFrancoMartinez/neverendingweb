// CV corto: si el texto de una columna no cabe en la página, reduce poco a poco
// el tamaño de letra de esa columna (hasta un 20 %). Si aun así no cabe, marca
// <body data-overflow> para que build-pdf.R avise.
(() => {
  const fit = (box) => {
    const inner = box && box.querySelector(".cvs-fit");
    if (!inner) return true;
    const cs = getComputedStyle(box);
    const room = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    let f = 1;
    inner.style.setProperty("--fit", f);
    while (inner.offsetHeight > room + 0.5 && f > 0.8) {
      f = Math.round((f - 0.01) * 100) / 100;
      inner.style.setProperty("--fit", f);
    }
    return inner.offsetHeight <= room + 0.5;
  };
  const run = () => {
    const ok = [fit(document.querySelector(".cvs-main")), fit(document.querySelector(".cvs-side-body"))];
    if (ok.includes(false)) document.body.dataset.overflow = ok[0] ? "side" : "main";
    document.body.dataset.fit = "done";
  };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(run);
})();
