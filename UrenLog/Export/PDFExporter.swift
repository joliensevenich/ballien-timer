import UIKit

/// PDF in de layout van het papieren "Weekrapport - Atelier": één A4-pagina per week,
/// precies zoals de Excel-export.
enum PDFExporter {
    private static let page = CGRect(x: 0, y: 0, width: 595.2, height: 841.8)
    private static let margin: CGFloat = 24

    static func write(_ report: ReportData, logo: UIImage? = XLSXWriter.logo) throws -> URL {
        let url = try report.exportURL(extension: "pdf")
        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = [
            kCGPDFContextTitle as String: "Urenrapport \(report.periodLabel)",
            kCGPDFContextAuthor as String: report.userName,
            kCGPDFContextCreator as String: "e. baillien - Timer",
        ]
        let sheets = FormReport.pages(for: report)
        try UIGraphicsPDFRenderer(bounds: page, format: format).writePDF(to: url) { ctx in
            for sheet in sheets {
                ctx.beginPage()
                UIColor.white.setFill()
                ctx.fill(page)
                draw(sheet, logo: logo, in: page.insetBy(dx: margin, dy: margin), context: ctx.cgContext)
                if let footer = sheet.footer { drawFooter(footer) }
            }
        }
        return url
    }

    /// Voettekst onderaan de pagina: links, midden en rechts.
    private static func drawFooter(_ footer: XLFooter) {
        let attributes: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 9), .foregroundColor: UIColor.darkGray]
        let y = page.maxY - margin + 4
        func width(_ text: String) -> CGFloat { (text as NSString).size(withAttributes: attributes).width }
        (footer.left as NSString).draw(at: CGPoint(x: margin, y: y), withAttributes: attributes)
        (footer.center as NSString).draw(at: CGPoint(x: page.midX - width(footer.center) / 2, y: y), withAttributes: attributes)
        (footer.right as NSString).draw(at: CGPoint(x: page.maxX - margin - width(footer.right), y: y), withAttributes: attributes)
    }

    /// Tekent een blad passend in `rect` (bovenaan, horizontaal gecentreerd).
    static func draw(_ sheet: XLSheet, logo: UIImage?, in rect: CGRect, context: CGContext) {
        let columnX = sheet.columnWidths.reduce(into: [0.0]) { $0.append($0.last! + XLSheet.columnPixels($1)) }
        let rowY = (1...sheet.lastRow).reduce(into: [0.0]) { $0.append($0.last! + XLSheet.rowPixels(sheet.rowHeight($1))) }
        let width = columnX.last!
        let height = rowY.last!
        let scale = min(rect.width / width, rect.height / height)

        context.saveGState()
        context.translateBy(x: rect.minX + (rect.width - width * scale) / 2, y: rect.minY)
        context.scaleBy(x: scale, y: scale)

        func frame(_ r: XLRange) -> CGRect {
            CGRect(x: columnX[r.column], y: rowY[r.row - 1],
                   width: columnX[r.lastColumn + 1] - columnX[r.column], height: rowY[r.lastRow] - rowY[r.row - 1])
        }

        // Elke zichtbare cel of samengevoegd blok, met de cel linksboven.
        var hidden = Set<[Int]>()
        for m in sheet.ranges {
            for r in m.row...m.lastRow {
                for c in m.column...m.lastColumn where r != m.row || c != m.column { hidden.insert([r, c]) }
            }
        }
        var blocks: [(CGRect, XLCell)] = []
        for (row, cells) in sheet.cells {
            for (column, cell) in cells where !hidden.contains([row, column]) {
                let range = sheet.ranges.first { $0.row == row && $0.column == column }
                    ?? XLRange(row: row, column: column, lastRow: row, lastColumn: column)
                blocks.append((frame(range), cell))
            }
        }

        let gray = UIColor(white: 217 / 255, alpha: 1)
        for (r, cell) in blocks where cell.style.isGray {
            gray.setFill()
            context.fill(r)
        }

        if let image = sheet.image, let logo {
            let c = image.content
            logo.draw(in: CGRect(x: c.x, y: c.y, width: c.width, height: c.height))
        }

        for (r, cell) in blocks { drawText(cell, in: r) }

        context.setStrokeColor(UIColor.black.cgColor)
        func line(_ from: CGPoint, _ to: CGPoint, thick: Bool) {
            context.setLineWidth(thick ? 2 : 0.75)
            context.move(to: from)
            context.addLine(to: to)
            context.strokePath()
        }
        for (r, cell) in blocks where cell.style.borderId != 0 {
            line(CGPoint(x: r.minX, y: r.minY), CGPoint(x: r.maxX, y: r.minY), thick: true)
            line(CGPoint(x: r.minX, y: r.maxY), CGPoint(x: r.maxX, y: r.maxY), thick: true)
            if cell.style.leftLine != .none {
                line(CGPoint(x: r.minX, y: r.minY), CGPoint(x: r.minX, y: r.maxY), thick: cell.style.leftLine == .thick)
            }
            if cell.style.rightLine != .none {
                line(CGPoint(x: r.maxX, y: r.minY), CGPoint(x: r.maxX, y: r.maxY), thick: cell.style.rightLine == .thick)
            }
        }
        context.restoreGState()
    }

    private static func drawText(_ cell: XLCell, in r: CGRect) {
        let text = cell.display
        guard !text.isEmpty else { return }
        let style = cell.style
        // Lettergrootte in punten omgezet naar de pixels van het blad.
        var font = UIFont(name: "Arial", size: style.fontSize * 4 / 3) ?? .systemFont(ofSize: style.fontSize * 4 / 3)
        var traits: UIFontDescriptor.SymbolicTraits = []
        if style.isBold { traits.insert(.traitBold) }
        if style.isItalic { traits.insert(.traitItalic) }
        if !traits.isEmpty, let descriptor = font.fontDescriptor.withSymbolicTraits(traits) {
            font = UIFont(descriptor: descriptor, size: font.pointSize)
        }
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = style.alignsLeft ? .left : style.alignsRight ? .right : .center
        paragraph.lineBreakMode = style.wraps ? .byWordWrapping : .byTruncatingTail
        let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: UIColor.black, .paragraphStyle: paragraph]

        let inset: CGFloat = 4
        let box = r.insetBy(dx: inset, dy: 2)
        let size = (text as NSString).boundingRect(
            with: CGSize(width: box.width, height: style.wraps ? box.height : .greatestFiniteMagnitude),
            options: style.wraps ? [.usesLineFragmentOrigin] : [], attributes: attributes, context: nil
        ).size
        let height = min(ceil(size.height), box.height)
        (text as NSString).draw(
            with: CGRect(x: box.minX, y: box.midY - height / 2, width: box.width, height: height),
            options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine], attributes: attributes, context: nil
        )
    }
}
