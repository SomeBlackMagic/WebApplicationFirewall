import * as crypto from 'crypto';

/**
 * Утилиты для хеширования, совместимые с фронтендом
 */
export class HashUtils {
    /**
     * SHA-256 хеширование (основной метод)
     * @param message - Сообщение для хеширования
     * @returns Хеш в hex формате
     */
    public static sha256(message: string): string {
        try {
            return crypto.createHash('sha256').update(message, 'utf8').digest('hex');
        } catch (error) {
            // Fallback на DJB2 в случае проблем
            return HashUtils.djb2Hash(message);
        }
    }

    /**
     * DJB2 хеш алгоритм - стабильный fallback, совместимый с фронтендом
     * @param str - Строка для хеширования
     * @returns Хеш в hex формате
     */
    public static djb2Hash(str: string): string {
        let hash = 5381;
        const input = typeof str === 'string' ? str : String(str);

        for (let i = 0; i < input.length; i++) {
            hash = ((hash << 5) + hash) + input.charCodeAt(i);
            hash = hash & 0xFFFFFFFF; // Приводим к 32-битному числу
        }

        // Конвертируем в положительное число и затем в hex
        const positiveHash = Math.abs(hash);
        return positiveHash.toString(16).padStart(8, '0');
    }

    /**
     * Универсальное хеширование с fallback
     * @param message - Сообщение для хеширования
     * @param preferDjb2 - Принудительно использовать DJB2 (для совместимости с мобильными)
     * @returns Хеш в hex формате
     */
    public static universalHash(message: string, preferDjb2: boolean = false): string {
        if (preferDjb2) {
            return HashUtils.djb2Hash(message);
        }

        try {
            return HashUtils.sha256(message);
        } catch (error) {
            return HashUtils.djb2Hash(message);
        }
    }

    /**
     * Проверяет, является ли хеш результатом DJB2 алгоритма
     * @param hash - Хеш для проверки
     * @returns true если это DJB2 хеш (8 символов hex)
     */
    public static isDjb2Hash(hash: string): boolean {
        return /^[a-f0-9]{8}$/.test(hash);
    }

    /**
     * Проверяет, является ли хеш результатом SHA-256 алгоритма
     * @param hash - Хеш для проверки
     * @returns true если это SHA-256 хеш (64 символа hex)
     */
    public static isSha256Hash(hash: string): boolean {
        return /^[a-f0-9]{64}$/.test(hash);
    }
}
