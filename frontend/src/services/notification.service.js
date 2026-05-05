import { httpService } from './http.service'

const BASE = 'notification/'

export const notificationService = {
    getSettings: () => httpService.get(BASE + 'settings'),
    saveSettings: (s) => httpService.put(BASE + 'settings', s),
    sendNow: () => httpService.post(BASE + 'send'),
}
