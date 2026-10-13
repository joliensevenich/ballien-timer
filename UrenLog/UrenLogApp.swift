import SwiftUI
import SwiftData

enum AppConfig {
    /// iCloud-sync vereist een betaald Apple Developer-account. Zet dit op true en voeg in
    /// Signing & Capabilities "iCloud" (CloudKit, container iCloud.com.jolien.urenlog) en
    /// "Push Notifications" weer toe zodra dat account er is.
    static let iCloudSync = false
}

@main
struct UrenLogApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    let container: ModelContainer = {
        let schema = Schema([Job.self, WorkEntry.self, WorkTypeOption.self])
        // Met iCloud-sync gebruikt .automatic de iCloud-container uit de entitlements.
        do {
            let config = ModelConfiguration(schema: schema,
                                            cloudKitDatabase: AppConfig.iCloudSync ? .automatic : .none)
            return try ModelContainer(for: schema, configurations: config)
        } catch {
            print("iCloud-opslag niet beschikbaar, lokaal opslaan: \(error)")
            let config = ModelConfiguration(schema: schema, cloudKitDatabase: .none)
            return try! ModelContainer(for: schema, configurations: config)
        }
    }()

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(container)
    }
}

struct ContentView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.scenePhase) private var scenePhase
    @State private var router = AppRouter.shared

    var body: some View {
        TabView(selection: $router.tab) {
            ClockView()
                .tabItem { Label("Klok", systemImage: "clock") }
                .tag(0)
            EntriesView()
                .tabItem { Label("Uren", systemImage: "list.bullet.rectangle") }
                .tag(1)
            ReportsView()
                .tabItem { Label("Rapport", systemImage: "chart.bar") }
                .tag(2)
            SettingsView()
                .tabItem { Label("Instellingen", systemImage: "gearshape") }
                .tag(3)
        }
        .task { WorkTypes.prepare(context) }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { WorkTypes.prepare(context) }
        }
    }
}
