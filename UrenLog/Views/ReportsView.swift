import SwiftUI
import SwiftData
import Charts

enum ReportPeriod: String, CaseIterable, Identifiable {
    case thisWeek, lastWeek, thisMonth, lastMonth, custom

    var id: String { rawValue }

    var title: String {
        switch self {
        case .thisWeek: "Deze week"
        case .lastWeek: "Vorige week"
        case .thisMonth: "Deze maand"
        case .lastMonth: "Vorige maand"
        case .custom: "Aangepast"
        }
    }

    func interval(customStart: Date, customEnd: Date, now: Date = .now) -> DateInterval {
        let cal = Periods.calendar
        switch self {
        case .thisWeek:
            return Periods.week(containing: now)
        case .lastWeek:
            return Periods.week(containing: cal.date(byAdding: .weekOfYear, value: -1, to: now)!)
        case .thisMonth:
            return Periods.month(containing: now)
        case .lastMonth:
            return Periods.month(containing: cal.date(byAdding: .month, value: -1, to: now)!)
        case .custom:
            let start = cal.startOfDay(for: min(customStart, customEnd))
            let end = cal.date(byAdding: .day, value: 1, to: cal.startOfDay(for: max(customStart, customEnd)))!
            return DateInterval(start: start, end: end)
        }
    }
}

struct ReportsView: View {
    @Query(sort: \WorkEntry.start) private var entries: [WorkEntry]
    @Query private var workTypeOptions: [WorkTypeOption]

    @AppStorage("userName") private var userName = ""

    @State private var period: ReportPeriod = .thisWeek
    /// Gewoon werk of privéwerk: nooit samen op hetzelfde rapport.
    @State private var kind: WorkKind = .work
    @State private var customStart = Calendar.current.date(byAdding: .day, value: -14, to: .now)!
    @State private var customEnd = Date.now
    @State private var jobNameFilter = ""
    @State private var projectNumberFilter = ""
    @State private var shared: SharedFile?
    @State private var exportError: String?

    private var interval: DateInterval {
        period.interval(customStart: customStart, customEnd: customEnd)
    }

    /// Alleen afgeronde registraties tellen mee in het rapport.
    private var reportEntries: [WorkEntry] {
        let number = projectNumberFilter.trimmingCharacters(in: .whitespaces)
        let name = jobNameFilter.trimmingCharacters(in: .whitespaces)
        return entries.filter { entry in
            !entry.isRunning
                && entry.isPrivate == (kind == .personal)
                && interval.contains(entry.start)
                && (name.isEmpty || entry.jobName.localizedCaseInsensitiveContains(name))
                && (number.isEmpty || entry.projectNumber.localizedCaseInsensitiveCompare(number) == .orderedSame)
        }
    }

    private var periodLabel: String {
        let last = interval.end.addingTimeInterval(-1)
        var label = "\(ReportFormat.date.string(from: interval.start)) – \(ReportFormat.date.string(from: last))"
        let number = projectNumberFilter.trimmingCharacters(in: .whitespaces)
        if !number.isEmpty { label += " · werfnr. \(number)" }
        let name = jobNameFilter.trimmingCharacters(in: .whitespaces)
        if !name.isEmpty { label += " · \(name)" }
        return label
    }

    /// Weekrapport, maandrapport, of urenrapport (zelf gekozen periode over meerdere weken).
    private var layout: ReportLayout {
        switch period {
        case .thisWeek, .lastWeek: return .week
        case .thisMonth, .lastMonth: return .month
        case .custom:
            let week = Periods.week(containing: interval.start)
            return interval.end <= week.end ? .week : .period
        }
    }

    private var chartUnit: Calendar.Component {
        interval.duration > 62 * 86400 ? .month : .day
    }

    private var chartData: [(date: Date, hours: Double)] {
        let cal = Periods.calendar
        return Dictionary(grouping: reportEntries) { cal.dateInterval(of: chartUnit, for: $0.start)!.start }
            .map { (date: $0.key, hours: $0.value.totalWorked() / 3600) }
            .sorted { $0.date < $1.date }
    }

    private func totals(by key: (WorkEntry) -> String) -> [(name: String, worked: TimeInterval)] {
        Dictionary(grouping: reportEntries, by: key)
            .map { (name: $0.key, worked: $0.value.totalWorked()) }
            .sorted { $0.worked > $1.worked }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Rapport", selection: $kind) {
                        ForEach(WorkKind.allCases, id: \.self) { Text($0.title).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                } footer: {
                    Text(kind == .personal ? "Alleen privéwerk. Gewoon werk staat op het werkrapport."
                                           : "Alleen gewoon werk. Privéwerk staat op een apart privérapport.")
                }

                Section("Periode") {
                    Picker("Periode", selection: $period) {
                        ForEach(ReportPeriod.allCases) { Text($0.title).tag($0) }
                    }
                    if period == .custom {
                        DatePicker("Van", selection: $customStart, displayedComponents: .date)
                        DatePicker("Tot en met", selection: $customEnd, displayedComponents: .date)
                    }
                    LabeledContent("Werfnummer") {
                        ProjectNumberField(text: $projectNumberFilter)
                            .multilineTextAlignment(.trailing)
                    }
                    LabeledContent("Werfnaam") {
                        JobNameField(text: $jobNameFilter)
                            .multilineTextAlignment(.trailing)
                    }
                }

                Section {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                        StatTile(title: "Totaal uren", value: Fmt.hours(reportEntries.totalWorked()))
                        StatTile(title: "Gewerkte dagen",
                                 value: "\(Set(reportEntries.map { Calendar.current.startOfDay(for: $0.start) }).count)")
                        StatTile(title: "Registraties", value: "\(reportEntries.count)")
                    }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                } header: {
                    Text(periodLabel)
                }

                Section {
                    Button {
                        export { try XLSXWriter.write($0) }
                    } label: {
                        Label("Exporteer als Excel (.xlsx)", systemImage: "tablecells")
                    }
                    Button {
                        export { try PDFExporter.write($0) }
                    } label: {
                        Label("Exporteer als PDF", systemImage: "doc.richtext")
                    }
                } header: {
                    Text("Exporteren")
                } footer: {
                    Text("Uren in uren:minuten (9:45 is 9 uur en 45 minuten). Lopende registraties tellen pas mee nadat je hebt uitgeklokt.")
                }

                if !chartData.isEmpty {
                    Section("Uren per \(chartUnit == .month ? "maand" : "dag")") {
                        Chart(chartData, id: \.date) { item in
                            BarMark(x: .value("Datum", item.date, unit: chartUnit),
                                    y: .value("Uren", item.hours))
                                .foregroundStyle(Color.accentColor)
                                .cornerRadius(3)
                        }
                        .chartXScale(domain: interval.start...interval.end)
                        .chartXAxis {
                            AxisMarks(values: .automatic(desiredCount: 6)) { _ in
                                AxisGridLine()
                                AxisValueLabel(format: chartUnit == .month
                                               ? .dateTime.month(.abbreviated)
                                               : .dateTime.day().month(.defaultDigits))
                            }
                        }
                        .frame(height: 180)
                        .padding(.vertical, 6)
                    }
                }

                totalsSection("Per uitgevoerd werk", totals { $0.workType })
                totalsSection("Per werfnummer", totals { $0.projectNumber.isEmpty ? "Zonder nummer" : $0.projectNumber })

            }
            .navigationTitle("Rapport")
            .scrollDismissesKeyboard(.interactively)
            .fullScreenCover(item: $shared) { file in
                ExportPreview(url: file.url)
            }
            .alert("Exporteren mislukt", isPresented: Binding(
                get: { exportError != nil },
                set: { if !$0 { exportError = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(exportError ?? "")
            }
        }
    }

    @ViewBuilder
    private func totalsSection(_ title: String, _ items: [(name: String, worked: TimeInterval)]) -> some View {
        if !items.isEmpty {
            Section(title) {
                ForEach(items, id: \.name) { item in
                    LabeledContent(item.name) {
                        Text(Fmt.hours(item.worked)).monospacedDigit()
                    }
                }
            }
        }
    }

    private func makeReport() -> ReportData {
        let rows = reportEntries.map { entry in
            ReportRow(start: entry.start,
                      end: entry.end ?? entry.start,
                      worked: entry.worked(),
                      projectNumber: entry.projectNumber,
                      workType: entry.workType,
                      project: entry.jobName,
                      note: entry.note)
        }
        return ReportData(userName: userName, periodLabel: periodLabel, interval: interval, rows: rows,
                          workTypes: WorkTypes.names(workTypeOptions), layout: layout, isPrivate: kind == .personal)
    }

    private func export(_ writer: (ReportData) throws -> URL) {
        do {
            shared = SharedFile(url: try writer(makeReport()))
        } catch {
            exportError = error.localizedDescription
        }
    }
}
