import SwiftUI
import UserNotifications

/// Welke tab open staat en of de back-upkeuze (delen of opslaan) getoond moet worden,
/// bijvoorbeeld na een tik op de wekelijkse melding.
@Observable
final class AppRouter {
    static let shared = AppRouter()

    var tab = 0
    var backupPrompt = false

    func showBackupPrompt() {
        tab = 3
        backupPrompt = true
    }
}

/// Wekelijkse melding om een back-up te maken.
enum BackupReminder {
    static let id = "weekly-backup"

    /// Dagen in de volgorde maandag … zondag, met het weekdagnummer van `Calendar` (zondag = 1).
    static let weekdays: [(name: String, value: Int)] = [
        ("Maandag", 2), ("Dinsdag", 3), ("Woensdag", 4), ("Donderdag", 5), ("Vrijdag", 6), ("Zaterdag", 7), ("Zondag", 1),
    ]

    /// Plant de melding; geeft false terug als meldingen niet toegestaan zijn.
    static func schedule(weekday: Int, minutes: Int) async -> Bool {
        let center = UNUserNotificationCenter.current()
        let granted = (try? await center.requestAuthorization(options: [.alert, .sound])) ?? false
        guard granted else { return false }
        center.removePendingNotificationRequests(withIdentifiers: [id])

        let content = UNMutableNotificationContent()
        content.title = "Tijd voor een back-up"
        content.body = "Maak een back-up van je uren en deel ze via bijvoorbeeld WhatsApp, of bewaar ze op je toestel."
        content.sound = .default
        var date = DateComponents()
        date.weekday = weekday
        date.hour = minutes / 60
        date.minute = minutes % 60
        let trigger = UNCalendarNotificationTrigger(dateMatching: date, repeats: true)
        try? await center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
        return true
    }

    static func cancel() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [id])
    }
}

/// Toont meldingen ook als de app open is, en opent de back-upkeuze na een tik op de melding.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        if response.notification.request.identifier == BackupReminder.id {
            DispatchQueue.main.async { AppRouter.shared.showBackupPrompt() }
        }
        completionHandler()
    }
}

/// Het deelmenu van iOS (WhatsApp, mail, AirDrop, …) voor een bestand.
struct ActivityView: UIViewControllerRepresentable {
    let url: URL
    var onComplete: (Bool) -> Void = { _ in }

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        controller.completionWithItemsHandler = { _, completed, _, _ in onComplete(completed) }
        return controller
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
