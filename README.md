# Minimado CLI

A command-line interface for managing your Minimado tasks.

## Installation

```bash
npm install -g minimado-cli
```

## Usage

### First time setup
```bash
mm config --set-user-id "your_clerk_user_id"
```

### Add tasks
```bash
mm "Buy groceries"
mm "Walk the dog"
```

### List tasks
```bash
# List incomplete tasks
mm list

# List all tasks
mm list --all
```

### Configuration
```bash
# Show current config
mm config --show

# Reset config
mm config --reset
```

## Commands

- `mm "task title"` - Add a new task
- `mm list` - List incomplete tasks
- `mm list --all` - List all tasks
- `mm config --show` - Show configuration
- `mm config --set-user-id <id>` - Set your Clerk User ID
- `mm config --reset` - Reset configuration

## License

MIT# minimado-cli
