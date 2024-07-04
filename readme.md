# PACHCA-NOTIFY-BOT
## English
You can specify various commands for the bot to execute using config.json. The bot operates on the principle of "Reminders" and dividing tasks into specific stages. Additionally, the Levenshtein algorithm is used to account for possible errors in command input. To simplify the process, reactions can also be employed when subtasks are completed at each stage: 👍 and 👎
> Upon completion of all stages, an xlsx file with statistics on the execution time of each task is also generated!
## Русский
С помощью config.json можно указывать различные команды для выполнения ботом. Бот работает по принципу "Напоминалки" и разделению задачи на определенный этап. Дополнитель: Используется алгоритм левенштейна для возможной погрешности в вводе команд. Для упрощения так же можно задействовать реакции при выполнение подзадач на этапах: 👍 и 👎
> По завершению всех этапов генерируется так же xlsx-файл со статистикой выполнения каждой задачи по времени!

## Used / Используется:
* Pachca API 
* DBSqlite
* nodejs