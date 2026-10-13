import UIKit

/// Excel-export in de layout van het papieren "Weekrapport - Atelier" (week-, maand- of urenrapport), één tabblad.
enum XLSXWriter {
    static func write(_ report: ReportData) throws -> URL {
        let url = try report.exportURL(extension: "xlsx")
        try data(for: report).write(to: url, options: .atomic)
        return url
    }

    static func data(for report: ReportData, logo: UIImage? = XLSXWriter.logo) -> Data {
        let sheets = [FormReport.sheet(for: report)]
        let image = zip(logo, sheets.first?.image).map { picture(logo: $0.0, placement: $0.1) }
        return Workbook(sheets: sheets, image: image).xlsx()
    }

    /// Blauw logo op wit, zoals op het papieren formulier.
    static var logo: UIImage? {
        Bundle.main.url(forResource: "logo_excel", withExtension: "png").flatMap { UIImage(contentsOfFile: $0.path) }
    }

    /// Doorzichtige afbeelding vanaf A1 met het logo op de juiste plek, scherp genoeg om te printen.
    private static func picture(logo: UIImage, placement: XLImage) -> Data {
        let scale = 3.0
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = false
        let size = CGSize(width: placement.width * scale, height: placement.height * scale)
        let c = placement.content
        return UIGraphicsImageRenderer(size: size, format: format).pngData { _ in
            logo.draw(in: CGRect(x: c.x * scale, y: c.y * scale, width: c.width * scale, height: c.height * scale))
        }
    }
}

private func zip<A, B>(_ a: A?, _ b: B?) -> (A, B)? {
    guard let a, let b else { return nil }
    return (a, b)
}
