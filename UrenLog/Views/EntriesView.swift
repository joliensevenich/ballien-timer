import SwiftUI
import SwiftData

struct EntriesView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \WorkEntry.start, order: .reverse) private var entries: [WorkEntry]
    @Query private var workTypeOptions: [WorkTypeOption]

    /// Zoekt in werfnaam en werfnummer.
    @State private var search = ""
    @State private var workTypeFilter: String?
    @State private var kindFilter: WorkKind?
    @State private var periodFilter: EntriesPeriod = .all
    /// Een dag in de gekozen week of maand.
    @State private var periodDate = Date()
    @State private var editing: WorkEntry?
    @State private var addingNew = false

    private var filtered: [WorkEntry] {
        let interval = periodFilter.interval(containing: periodDate)
        let text = search.trimmingCharacters(in: .whitespaces)
        return entries.filter { entry in
            (text.isEmpty || entry.jobName.localizedCaseInsensitiveContains(text)
                || entry.projectNumber.localizedCaseInsensitiveContains(text))
                && (workTypeFilter == nil || entry.workType == workTypeFilter)
                && (kindFilter == nil || entry.isPrivate == (kindFilter == .personal))
                && (interval == nil || interval!.contains(entry.start))
        }
    }

    private var isFiltered: Bool { !search.isEmpty || workTypeFilter != nil || kindFilter != nil || periodFilter != .all }

    /// Keuzes uit Instellingen plus namen die alleen nog in oude registraties voorkomen.
    private var workTypeNames: [String] {
        let names = WorkTypes.names(workTypeOptions)
        let extra = Set(entries.map(\.workType)).subtracting(names).sorted()
        return names + extra
    }

    /// Per maand, nieuwste maand bovenaan.
    private var months: [(month: Date, entries: [WorkEntry])] {
        Dictionary(grouping: filtered) { Periods.startOfMonth($0.start) }
            .map { (month: $0.key, entries: $0.value) }
            .sorted { $0.month > $1.month }
    }

    var body: some View {
        NavigationStack {
            Group {
                if entries.isEmpty {
                    ContentUnavailableView("Nog geen uren",
                                           systemImage: "clock.badge.questionmark",
                                           description: Text("Klok in via het tabblad Klok of voeg uren handmatig toe met +."))
                } else if filtered.isEmpty {
                    ContentUnavailableView("Geen uren gevonden",
                                           systemImage: "line.3.horizontal.decrease.circle",
                                           description: Text("Er zijn geen uren voor deze filter. Kies een andere periode of wis de filters."))
                } else {
                    list
                }
            }
            .navigationTitle("Uren")
            // Klein titel bovenaan, zodat de filters eronder altijd zichtbaar blijven.
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .top, spacing: 0) {
                if !entries.isEmpty { filterBar }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        addingNew = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(item: $editing) { entry in
                EntryEditView(entry: entry)
            }
            .sheet(isPresented: $addingNew) {
                EntryEditView(entry: nil)
            }
        }
    }

    /// Filters altijd zichtbaar boven de lijst: periode (alles, week of maand), werf en uitgevoerd werk.
    private var filterBar: some View {
        VStack(spacing: 10) {
            Picker("Periode", selection: $periodFilter) {
                ForEach(EntriesPeriod.allCases, id: \.self) { Text($0.title).tag($0) }
            }
            .pickerStyle(.segmented)
            .onChange(of: periodFilter) { periodDate = Date() }

            if periodFilter != .all {
                HStack {
                    Button { step(-1) } label: { Image(systemName: "chevron.left").frame(width: 36, height: 30) }
                        .accessibilityLabel("Vorige")
                    Spacer()
                    // Tik op de periode om terug te gaan naar deze week of maand.
                    Button { periodDate = Date() } label: {
                        Text(periodFilter.title(for: periodDate))
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.primary)
                    }
                    Spacer()
                    Button { step(1) } label: { Image(systemName: "chevron.right").frame(width: 36, height: 30) }
                        .accessibilityLabel("Volgende")
                }
            }

            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField("Werfnaam of -nummer", text: $search)
                    .autocorrectionDisabled()
                    .submitLabel(.search)
                if !search.isEmpty {
                    Button { search = "" } label: {
                        Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                    }
                    .buttonStyle(.borderless)
                    .accessibilityLabel("Wis zoekterm")
                }
            }
            .font(.subheadline)
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(Color(.tertiarySystemFill), in: Capsule())

            HStack(spacing: 8) {
                Menu {
                    Picker("Soort", selection: $kindFilter) {
                        Text("Werk en privé").tag(WorkKind?.none)
                        ForEach(WorkKind.allCases, id: \.self) { Text($0.title).tag(Optional($0)) }
                    }
                } label: {
                    FilterChip(title: kindFilter?.title ?? "Werk en privé", icon: "person", active: kindFilter != nil)
                }
                Menu {
                    Picker("Uitgevoerd werk", selection: $workTypeFilter) {
                        Text("Alle werken").tag(String?.none)
                        ForEach(workTypeNames, id: \.self) { Text($0).tag(Optional($0)) }
                    }
                } label: {
                    FilterChip(title: workTypeFilter ?? "Alle werken", icon: "hammer", active: workTypeFilter != nil)
                }
                Spacer(minLength: 0)
            }

            HStack {
                Text("Totaal: \(Fmt.hours(filtered.totalWorked()))")
                    .font(.subheadline.weight(.semibold))
                    .monospacedDigit()
                Text("· \(filtered.count) \(filtered.count == 1 ? "registratie" : "registraties")")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Spacer()
                if isFiltered {
                    Button("Wis filters") {
                        search = ""
                        workTypeFilter = nil
                        kindFilter = nil
                        periodFilter = .all
                    }
                    .font(.subheadline)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.bar)
    }

    private func step(_ offset: Int) {
        let component: Calendar.Component = periodFilter == .week ? .weekOfYear : .month
        periodDate = Periods.calendar.date(byAdding: component, value: offset, to: periodDate) ?? periodDate
    }

    private var list: some View {
        TimelineView(.periodic(from: .now, by: 30)) { timeline in
            List {
                ForEach(months, id: \.month) { group in
                    Section {
                        ForEach(group.entries) { entry in
                            Button {
                                editing = entry
                            } label: {
                                EntryRow(entry: entry, now: timeline.date)
                            }
                            .foregroundStyle(.primary)
                        }
                        .onDelete { offsets in
                            for index in offsets {
                                context.delete(group.entries[index])
                            }
                        }
                    } header: {
                        HStack {
                            Text(Fmt.month(group.month))
                            Spacer()
                            Text(Fmt.hours(group.entries.totalWorked(at: timeline.date)))
                                .monospacedDigit()
                        }
                    }
                }
            }
        }
    }
}

/// Gewoon werk of privéwerk; ze komen nooit samen op een rapport.
enum WorkKind: CaseIterable {
    case work, personal

    var title: String {
        switch self {
        case .work: "Werk"
        case .personal: "Privé"
        }
    }
}

/// Periodefilter in de lijst met uren.
enum EntriesPeriod: CaseIterable {
    case all, week, month

    var title: String {
        switch self {
        case .all: "Alles"
        case .week: "Week"
        case .month: "Maand"
        }
    }

    func interval(containing date: Date) -> DateInterval? {
        switch self {
        case .all: nil
        case .week: Periods.week(containing: date)
        case .month: Periods.month(containing: date)
        }
    }

    /// "Week 41: 05-10-2026 – 11-10-2026" of "Oktober 2026".
    func title(for date: Date) -> String {
        guard let interval = interval(containing: date) else { return "" }
        if self == .month { return Fmt.month(date) }
        let number = Calendar(identifier: .iso8601).component(.weekOfYear, from: interval.start)
        return "Week \(number): \(Fmt.date(interval.start)) – \(Fmt.date(interval.end.addingTimeInterval(-1)))"
    }
}

/// Knop van een filter: toont de gekozen waarde, gekleurd als de filter actief is.
private struct FilterChip: View {
    let title: String
    let icon: String
    let active: Bool

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: icon)
            Text(title).lineLimit(1)
            Image(systemName: "chevron.down").font(.caption2.weight(.semibold))
        }
        .font(.subheadline)
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .foregroundStyle(active ? Color.white : Color.accentColor)
        .background(active ? Color.accentColor : Color.accentColor.opacity(0.12), in: Capsule())
    }
}

struct EntryRow: View {
    let entry: WorkEntry
    let now: Date

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(Fmt.date(entry.start))
                        .font(.body.weight(.medium))
                        .monospacedDigit()
                    if !entry.projectNumber.isEmpty {
                        Text(entry.projectNumber)
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.accentColor.opacity(0.15), in: Capsule())
                    }
                    if entry.isPrivate {
                        Text("Privé")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.orange)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.orange.opacity(0.15), in: Capsule())
                    }
                }
                HStack(spacing: 4) {
                    Text(entry.workType)
                    if !entry.jobName.isEmpty {
                        Text("· \(entry.jobName)")
                    }
                    Text("·")
                    Text(Fmt.time(entry.start))
                    Text("–")
                    if let end = entry.end {
                        Text(Fmt.time(end))
                    } else {
                        Text("bezig").foregroundStyle(.green)
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                if !entry.note.isEmpty {
                    Text(entry.note)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer()
            Text(Fmt.duration(entry.worked(at: now)))
                .monospacedDigit()
        }
        .padding(.vertical, 2)
    }
}
