import SwiftUI
import SwiftData

// MARK: - Uitgevoerde werken

struct WorkTypesView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: [SortDescriptor(\WorkTypeOption.sortOrder), SortDescriptor(\WorkTypeOption.createdAt)])
    private var workTypeOptions: [WorkTypeOption]

    @State private var edit: WorkTypeEdit?
    @State private var name = ""

    var body: some View {
        List {
            Section {
                ForEach(workTypeOptions) { option in
                    Button {
                        name = option.name
                        edit = .rename(option)
                    } label: {
                        Text(option.name)
                            .foregroundStyle(.primary)
                    }
                }
                .onDelete { offsets in
                    for index in offsets { context.delete(workTypeOptions[index]) }
                }
                .onMove(perform: move)
                Button {
                    name = ""
                    edit = .add
                } label: {
                    Label("Nieuw werk", systemImage: "plus")
                }
                if !missingDefaults.isEmpty {
                    Button("Standaardkeuzes terugzetten") { restoreDefaults() }
                }
            } footer: {
                Text("Tik om te hernoemen, veeg om te verwijderen, en tik op Wijzig om de volgorde te veranderen. Bestaande uren behouden hun werk, ook als je een keuze verwijdert.")
            }
        }
        .navigationTitle("Uitgevoerde werken")
        .toolbar { EditButton() }
        .alert(edit?.title ?? "", isPresented: Binding(
            get: { edit != nil },
            set: { if !$0 { edit = nil } }
        )) {
            TextField("Naam", text: $name)
            Button("Annuleer", role: .cancel) {}
            Button("Bewaar") { save() }
        } message: {
            if case .rename = edit {
                Text("Uren met deze keuze krijgen ook de nieuwe naam.")
            }
        }
    }

    private var missingDefaults: [String] {
        let current = Set(workTypeOptions.map { $0.name.lowercased() })
        return WorkTypes.defaults.filter { !current.contains($0.lowercased()) }
    }

    private func save() {
        let clean = WorkTypes.clean(name)
        guard let edit, !clean.isEmpty else { return }
        let exists = workTypeOptions.contains { $0.name.lowercased() == clean.lowercased() }
        switch edit {
        case .add:
            guard !exists else { return }
            context.insert(WorkTypeOption(name: clean, sortOrder: (workTypeOptions.map(\.sortOrder).max() ?? -1) + 1))
        case .rename(let option):
            let old = option.name
            guard clean != old else { return }
            guard !exists || clean.lowercased() == old.lowercased() else { return }
            option.name = clean
            let entries = (try? context.fetch(FetchDescriptor<WorkEntry>())) ?? []
            for entry in entries where entry.workType == old {
                entry.workType = clean
            }
            if UserDefaults.standard.string(forKey: "lastWorkType") == old {
                UserDefaults.standard.set(clean, forKey: "lastWorkType")
            }
        }
    }

    private func move(from source: IndexSet, to destination: Int) {
        var ordered = workTypeOptions
        ordered.move(fromOffsets: source, toOffset: destination)
        for (i, option) in ordered.enumerated() { option.sortOrder = i }
    }

    private func restoreDefaults() {
        var order = (workTypeOptions.map(\.sortOrder).max() ?? -1) + 1
        for name in missingDefaults {
            context.insert(WorkTypeOption(name: name, sortOrder: order))
            order += 1
        }
    }
}

enum WorkTypeEdit {
    case add
    case rename(WorkTypeOption)

    var title: String {
        switch self {
        case .add: "Nieuw uitgevoerd werk"
        case .rename: "Werk hernoemen"
        }
    }
}
