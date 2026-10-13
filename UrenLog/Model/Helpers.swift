import SwiftUI

extension Color {
    init(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("#") { s.removeFirst() }
        var value: UInt64 = 0
        Scanner(string: s).scanHexInt64(&value)
        self.init(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }
}

enum Fmt {
    /// "7u 45m"
    static func duration(_ t: TimeInterval) -> String {
        let minutes = Int((t / 60).rounded())
        return "\(minutes / 60)u \(String(format: "%02d", minutes % 60))m"
    }

    /// "07:05:33"
    static func clock(_ t: TimeInterval) -> String {
        let s = Int(t)
        return String(format: "%02d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
    }

    /// "7:45" (uren:minuten)
    static func hours(_ t: TimeInterval) -> String {
        let minutes = Int((t / 60).rounded())
        return "\(minutes / 60):\(String(format: "%02d", minutes % 60))"
    }

    /// "03-10-2026"
    static func date(_ date: Date) -> String {
        ReportFormat.date.string(from: date)
    }

    /// "Oktober 2026"
    static func month(_ date: Date) -> String {
        ReportFormat.month.string(from: date).capitalized
    }

    static func time(_ date: Date) -> String {
        ReportFormat.time.string(from: date)
    }
}

enum Periods {
    static var calendar: Calendar {
        var c = Calendar.current
        c.firstWeekday = 2 // maandag
        return c
    }

    static func day(containing date: Date) -> DateInterval {
        calendar.dateInterval(of: .day, for: date)!
    }

    static func week(containing date: Date) -> DateInterval {
        calendar.dateInterval(of: .weekOfYear, for: date)!
    }

    static func month(containing date: Date) -> DateInterval {
        calendar.dateInterval(of: .month, for: date)!
    }

    static func startOfMonth(_ date: Date) -> Date {
        month(containing: date).start
    }
}

struct SharedFile: Identifiable {
    let id = UUID()
    let url: URL
}

/// Tekstveld met een knop om de tekst van papier te scannen (werfnummer of werfnaam).
struct ScanTextField: View {
    @Binding var text: String
    /// Wat gescand wordt, bv. "werfnummer" of "werfnaam".
    var subject = "werfnummer"
    var capitalization: TextInputAutocapitalization = .characters
    @State private var scanning = false

    var body: some View {
        HStack {
            TextField("Typ of scan", text: $text)
                .textInputAutocapitalization(capitalization)
                .autocorrectionDisabled()
            Button {
                scanning = true
            } label: {
                Image(systemName: "text.viewfinder")
                    .font(.title3)
            }
            .buttonStyle(.borderless)
            .accessibilityLabel("Scan \(subject)")
        }
        .sheet(isPresented: $scanning) {
            ScannerSheet(subject: subject) { scanned in
                text = scanned
                scanning = false
            }
        }
    }
}

/// Tekstveld voor het werfnummer met een knop om het van papier te scannen.
struct ProjectNumberField: View {
    @Binding var text: String

    var body: some View {
        ScanTextField(text: $text)
    }
}

/// Tekstveld voor de werfnaam: typen of scannen, net als het werfnummer.
struct JobNameField: View {
    @Binding var text: String

    var body: some View {
        ScanTextField(text: $text, subject: "werfnaam", capitalization: .words)
    }
}
