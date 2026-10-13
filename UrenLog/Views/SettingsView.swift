import SwiftUI
import SwiftData
import UniformTypeIdentifiers

struct SettingsView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: [SortDescriptor(\WorkTypeOption.sortOrder), SortDescriptor(\WorkTypeOption.createdAt)])
    private var workTypeOptions: [WorkTypeOption]

    @AppStorage("userName") private var userName = ""
    @State private var iCloudAvailable = FileManager.default.ubiquityIdentityToken != nil

    @AppStorage("lastBackupDate") private var lastBackupDate: Double = 0
    @State private var backupDocument: BackupDocument?
    @State private var exportingBackup = false
    @State private var importingBackup = false
    @State private var pendingBackup: Backup?
    @State private var backupMessage: String?
    @State private var sharedBackup: SharedFile?
    @Bindable private var router = AppRouter.shared

    @AppStorage("backupReminder") private var reminderOn = false
    @AppStorage("backupReminderWeekday") private var reminderWeekday = 6   // vrijdag
    @AppStorage("backupReminderMinutes") private var reminderMinutes = 16 * 60

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Je naam", text: $userName)
                        .textContentType(.name)
                } header: {
                    Text("Profiel")
                } footer: {
                    Text("Je naam staat bovenaan geëxporteerde rapporten.")
                }

                Section {
                    NavigationLink {
                        WorkTypesView()
                    } label: {
                        LabeledContent {
                            Text("\(WorkTypes.names(workTypeOptions).count)")
                        } label: {
                            Label("Uitgevoerde werken", systemImage: "hammer")
                        }
                    }
                } header: {
                    Text("Keuzelijsten")
                }

                Section {
                    LabeledContent("Status") {
                        if !AppConfig.iCloudSync {
                            Label("Uit", systemImage: "icloud.slash")
                                .foregroundStyle(.secondary)
                        } else {
                            Label(iCloudAvailable ? "Aan" : "Niet ingelogd",
                                  systemImage: iCloudAvailable ? "checkmark.icloud" : "xmark.icloud")
                                .foregroundStyle(iCloudAvailable ? .green : .orange)
                        }
                    }
                } header: {
                    Text("iCloud")
                } footer: {
                    Text(!AppConfig.iCloudSync
                         ? "Je uren staan alleen op deze iPhone. Maak regelmatig een back-up, zodat je niets kwijtraakt als je toestel stuk of verloren gaat."
                         : iCloudAvailable
                         ? "Je uren worden automatisch in je privé-iCloud bewaard en gesynchroniseerd met je andere apparaten."
                         : "Log in bij iCloud via de Instellingen-app om je uren te bewaren en te synchroniseren. Tot die tijd worden ze alleen op dit toestel bewaard.")
                }

                Section {
                    Button {
                        shareBackup()
                    } label: {
                        Label("Back-up delen", systemImage: "square.and.arrow.up")
                    }

                    Button {
                        saveBackup()
                    } label: {
                        Label("Back-up opslaan op toestel", systemImage: "square.and.arrow.down")
                    }
                    .fileExporter(isPresented: $exportingBackup,
                                  document: backupDocument,
                                  contentType: .json,
                                  defaultFilename: Backup.fileName) { result in
                        switch result {
                        case .success:
                            lastBackupDate = Date.now.timeIntervalSince1970
                            backupMessage = "De back-up is opgeslagen."
                        case .failure(let error):
                            backupMessage = "Opslaan mislukt: \(error.localizedDescription)"
                        }
                    }

                    Button {
                        importingBackup = true
                    } label: {
                        Label("Back-up terugzetten", systemImage: "arrow.counterclockwise")
                    }
                    .fileImporter(isPresented: $importingBackup, allowedContentTypes: [.json]) { result in
                        openBackup(result)
                    }

                    Toggle("Wekelijkse herinnering", isOn: $reminderOn)
                    if reminderOn {
                        Picker("Dag", selection: $reminderWeekday) {
                            ForEach(BackupReminder.weekdays, id: \.value) { Text($0.name).tag($0.value) }
                        }
                        DatePicker("Uur", selection: reminderTime, displayedComponents: .hourAndMinute)
                    }
                } header: {
                    Text("Back-up")
                } footer: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Bewaar een kopie van al je uren als bestand: deel ze via WhatsApp of mail, of bewaar ze in Bestanden of iCloud Drive. Met de wekelijkse herinnering krijg je een melding om dat te doen.")
                        if lastBackupDate > 0 {
                            Text("Laatste back-up: \(Fmt.date(Date(timeIntervalSince1970: lastBackupDate))) om \(Fmt.time(Date(timeIntervalSince1970: lastBackupDate)))")
                        }
                    }
                }

                Section {
                    LabeledContent("Versie",
                                   value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
                } footer: {
                    Image("Logo")
                        .renderingMode(.template)
                        .resizable()
                        .scaledToFit()
                        .frame(height: 36)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 24)
                }
            }
            .navigationTitle("Instellingen")
            .sheet(item: $sharedBackup) { file in
                ActivityView(url: file.url) { completed in
                    if completed { lastBackupDate = Date.now.timeIntervalSince1970 }
                }
                .presentationDetents([.medium, .large])
            }
            .alert("Tijd voor een back-up", isPresented: $router.backupPrompt) {
                // Even wachten tot de melding weg is, anders opent iOS het volgende venster niet.
                Button("Delen") { afterDismiss(shareBackup) }
                Button("Opslaan op toestel") { afterDismiss(saveBackup) }
                Button("Later", role: .cancel) {}
            } message: {
                Text("Maak een kopie van je uren, zodat je niets kwijtraakt.")
            }
            .onChange(of: reminderOn) { updateReminder() }
            .onChange(of: reminderWeekday) { updateReminder() }
            .onChange(of: reminderMinutes) { updateReminder() }
            .confirmationDialog(restoreTitle, isPresented: Binding(
                get: { pendingBackup != nil },
                set: { if !$0 { pendingBackup = nil } }
            ), titleVisibility: .visible) {
                Button("Samenvoegen met huidige uren") { restore(replace: false) }
                Button("Alles vervangen", role: .destructive) { restore(replace: true) }
                Button("Annuleer", role: .cancel) { pendingBackup = nil }
            } message: {
                Text("Samenvoegen voegt alleen registraties toe die nog niet bestaan. Alles vervangen wist eerst al je huidige uren\(AppConfig.iCloudSync ? ", ook in iCloud" : ""). In beide gevallen worden ook je naam, de keuzelijst en de instellingen teruggezet.")
            }
            .alert("Back-up", isPresented: Binding(
                get: { backupMessage != nil },
                set: { if !$0 { backupMessage = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(backupMessage ?? "")
            }
            .onReceive(NotificationCenter.default.publisher(for: .NSUbiquityIdentityDidChange)) { _ in
                iCloudAvailable = FileManager.default.ubiquityIdentityToken != nil
            }
        }
    }
}

extension SettingsView {
    private var restoreTitle: String {
        guard let backup = pendingBackup else { return "" }
        return "Back-up van \(Fmt.date(backup.exportedAt)) met \(backup.entries.count) registraties terugzetten?"
    }

    private func afterDismiss(_ action: @escaping () -> Void) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: action)
    }

    private var reminderTime: Binding<Date> {
        Binding(
            get: { Calendar.current.date(bySettingHour: reminderMinutes / 60, minute: reminderMinutes % 60, second: 0, of: .now) ?? .now },
            set: {
                let c = Calendar.current.dateComponents([.hour, .minute], from: $0)
                reminderMinutes = (c.hour ?? 0) * 60 + (c.minute ?? 0)
            }
        )
    }

    private func updateReminder() {
        guard reminderOn else {
            BackupReminder.cancel()
            return
        }
        Task {
            if !(await BackupReminder.schedule(weekday: reminderWeekday, minutes: reminderMinutes)) {
                reminderOn = false
                backupMessage = "Meldingen staan uit voor deze app. Zet ze aan via Instellingen > Meldingen > e. baillien - Timer."
            }
        }
    }

    /// Back-up als bestand delen via het deelmenu (WhatsApp, mail, AirDrop, …).
    private func shareBackup() {
        do {
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(Backup.fileName).json")
            try Backup(context: context).encoded().write(to: url, options: .atomic)
            sharedBackup = SharedFile(url: url)
        } catch {
            backupMessage = "Back-up maken mislukt: \(error.localizedDescription)"
        }
    }

    private func saveBackup() {
        do {
            backupDocument = BackupDocument(data: try Backup(context: context).encoded())
            exportingBackup = true
        } catch {
            backupMessage = "Back-up maken mislukt: \(error.localizedDescription)"
        }
    }

    private func openBackup(_ result: Result<URL, Error>) {
        do {
            let url = try result.get()
            let accessing = url.startAccessingSecurityScopedResource()
            defer { if accessing { url.stopAccessingSecurityScopedResource() } }
            pendingBackup = try Backup.decode(Data(contentsOf: url))
        } catch {
            backupMessage = error.localizedDescription
        }
    }

    private func restore(replace: Bool) {
        guard let backup = pendingBackup else { return }
        pendingBackup = nil
        do {
            let result = try backup.restore(into: context, replace: replace)
            var message = "\(result.added) registraties teruggezet."
            if result.skipped > 0 {
                message += " \(result.skipped) bestonden al en zijn overgeslagen."
            }
            backupMessage = message
            // Herinnering uit de back-up opnieuw plannen.
            updateReminder()
        } catch {
            backupMessage = "Terugzetten mislukt: \(error.localizedDescription)"
        }
    }
}
