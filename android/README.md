# Lucent для Android

Нативный клиент к OpenAI-совместимым API. Ключи и чаты лежат в файле приложения, запросы идут с телефона напрямую — без браузерного прокси. Так работают и публичные провайдеры, и Ollama / LM Studio в локальной сети (`http://…`).

## Сборка APK на GitHub

1. Запушьте репозиторий на GitHub (ветка `main` или `master`).
2. Откройте **Actions → Build Android APK**. Workflow также запускается сам, если меняется каталог `android/`.
3. Скачайте артефакт `lucent-apk`.
4. Установите `app-release.apk`. Подпись отладочная, поэтому Android попросит разрешить установку из этого источника.

Для публикации в магазин замените `signingConfig` в `android/app/build.gradle.kts` на свой keystore и не коммитьте пароли.

Пресеты: OpenAI, OpenRouter, Groq, Together, Fireworks, DeepSeek, Mistral, xAI, Cerebras, Ollama, LM Studio и произвольный `/v1`.
