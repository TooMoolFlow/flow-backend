/**
 * Парсит SLA строку в минуты
 * @param {string|number} sla - SLA значение (например: "1h", "4h", "8h", "1d", "3d", "1w" или число в минутах)
 * @returns {number} - количество минут
 */
export function parseSlaToMinutes(sla) {
    if (typeof sla === 'number') {
        return sla;
    }
    
    if (typeof sla === 'string') {
        const slaStr = sla.trim();
        
        if (slaStr.endsWith('h')) {
            return parseInt(slaStr) * 60; // часы в минуты
        } else if (slaStr.endsWith('d')) {
            return parseInt(slaStr) * 24 * 60; // дни в минуты
        } else if (slaStr.endsWith('w')) {
            return parseInt(slaStr) * 7 * 24 * 60; // недели в минуты
        } else {
            // Попробуем парсить как число (минуты)
            const parsed = parseInt(slaStr);
            return !isNaN(parsed) ? parsed : 0;
        }
    }
    
    return 0;
}

/**
 * Конвертирует минуты в читаемый формат
 * @param {number} minutes - количество минут
 * @returns {string} - читаемый формат (например: "1h", "2d", "1w")
 */
export function formatMinutesToSla(minutes) {
    if (minutes < 60) {
        return `${minutes}m`;
    } else if (minutes < 24 * 60) {
        return `${Math.round(minutes / 60)}h`;
    } else if (minutes < 7 * 24 * 60) {
        return `${Math.round(minutes / (24 * 60))}d`;
    } else {
        return `${Math.round(minutes / (7 * 24 * 60))}w`;
    }
}
