# Game settings

Edit `settings.json` to change timing. All durations are in **seconds**.

| Key | Description | Default |
|-----|-------------|---------|
| `timing.nightRoundTime` | Duration of each night phase | 60 |
| `timing.dayRoundTime`   | Duration of each day phase (legacy) | 120 |
| `timing.votingTime`     | Duration of voting (day) phase; overrides `dayRoundTime` if set | 120 |

If the file is missing or invalid, defaults are used.
