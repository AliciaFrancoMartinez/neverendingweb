// merge-pdf.swift — une varios PDF en uno conservando los enlaces (PDFKit de macOS).
// Lo usa build-pdf.R para poner el CV corto como primera página del CV largo.
//   swift CV/_scripts/merge-pdf.swift salida.pdf entrada1.pdf entrada2.pdf … principal.pdf
// El último PDF es el principal: las páginas de los anteriores se insertan delante de él,
// dentro del mismo documento, para que sus enlaces internos (el índice) sigan funcionando.
// (build-pdf.R lo compila una vez en CV/_scripts/.bin/ para no recompilarlo en cada render)
import Foundation
import PDFKit

func fail(_ msg: String) -> Never {
  FileHandle.standardError.write((msg + "\n").data(using: .utf8)!)
  exit(1)
}

let args = CommandLine.arguments
guard args.count >= 3 else { fail("uso: merge-pdf salida.pdf entrada1.pdf … principal.pdf") }
let paths = Array(args[2...])
guard let main = PDFDocument(url: URL(fileURLWithPath: paths.last!)) else { fail("no puedo abrir \(paths.last!)") }

var at = 0
for path in paths.dropLast() {
  guard let doc = PDFDocument(url: URL(fileURLWithPath: path)) else { fail("no puedo abrir \(path)") }
  for i in 0..<doc.pageCount {
    if let page = doc.page(at: i)?.copy() as? PDFPage {
      main.insert(page, at: at)
      at += 1
    }
  }
}
if !main.write(to: URL(fileURLWithPath: args[1])) { fail("no puedo escribir \(args[1])") }
