# weekly-pace

Мод для Claude Code: шкала недельного лимита над полем ввода.

- **Заливка** — сколько недельного лимита (`seven_day`) уже израсходовано.
- **Пунктир** — плановый расход: какая доля недели прошла. Неделя берётся из времени сброса, которое сообщает сервер; если его нет — от среды 10:00 по местному времени.
- **Цвет**: зелёный — в плане или медленнее, жёлтый — обгоняете план, красный — обгоняете больше чем на 10 п.п.
- Подпись: `факт% / план% (разница) · сброс через …`.

Работает в десктоп-приложении Claude (шкала растягивается на ширину поля ввода) и в терминале (текстовая полоска). Фактический процент появляется после первого ответа в сессии и только на подписке, где сервер сообщает недельный лимит.

## Язык

Подписи на русском или английском, выбираются автоматически: по настройке `language` Claude Code, а если её нет — по локали системы (ru/uk/be → русский, иначе английский).

## English

A weekly-limit bar above the Claude Code prompt: the fill is how much of the weekly (`seven_day`) limit is used, the dashed line is the planned pace (share of the week elapsed). Green — on or under pace, yellow — ahead, red — more than 10 points ahead. Labels switch to English automatically.

## Установка

В терминальной сессии Claude Code:

```
/plugin install weekly-pace --marketplace kvartavlad/claude-weekly-pace
```

Ответьте `y` на вопрос о добавлении маркетплейса, затем выберите область (user — для всех сессий).

Из shell:

```bash
claude plugin install weekly-pace --marketplace kvartavlad/claude-weekly-pace
```

В десктоп-приложении, где `/plugin` не работает: нажмите + рядом с полем ввода → Plugins → Add marketplace с `kvartavlad/claude-weekly-pace` → Add plugin.

## Лицензия

MIT
