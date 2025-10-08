# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rails 8.0.3 application using Ruby 3.4.5 with the following stack:
- **Database**: SQLite3 (development, test, production)
- **Frontend**: Hotwire (Turbo + Stimulus), Tailwind CSS, Importmap
- **Background Jobs**: Solid Queue
- **Cache**: Solid Cache
- **WebSockets**: Solid Cable
- **Deployment**: Kamal (Docker-based)
- **Web Server**: Puma (development), Thruster (production)

## Development Commands

### Initial Setup
```bash
bin/setup
# Installs dependencies, prepares database, and starts development server
```

### Running the Application
```bash
bin/dev
# Starts both web server and Tailwind CSS watcher via Procfile.dev
```

### Testing
```bash
bin/rails test                    # Run all tests
bin/rails test test/models        # Run model tests
bin/rails test test/controllers   # Run controller tests
bin/rails test test/integration   # Run integration tests
bin/rails test:system             # Run system tests
```

### Code Quality
```bash
bin/rubocop                       # Run linter (Rails Omakase style)
bin/rubocop -a                    # Auto-correct offenses
bin/brakeman                      # Security vulnerability scan
```

### Database
```bash
bin/rails db:create               # Create database
bin/rails db:migrate              # Run migrations
bin/rails db:prepare              # Create and migrate database
bin/rails db:seed                 # Load seed data
bin/rails db:reset                # Drop, create, migrate, seed
bin/rails dbconsole               # Database console
```

### Assets
```bash
bin/rails assets:precompile       # Precompile assets for production
bin/rails tailwindcss:watch       # Watch Tailwind CSS (auto-run by bin/dev)
bin/rails tailwindcss:build       # Build Tailwind CSS
```

### Kamal Deployment
```bash
bin/kamal setup                   # Initial server setup
bin/kamal deploy                  # Deploy application
bin/kamal console                 # Rails console on server
bin/kamal shell                   # SSH into container
bin/kamal logs                    # Tail application logs
bin/kamal dbc                     # Database console on server
```

## Architecture

### Database Configuration
- **Multiple databases in production**: Primary, cache, queue, and cable databases all use SQLite3
- **Storage location**: All SQLite databases stored in `storage/` directory
- **Production volumes**: Persistent storage via Docker volume `dbcours_storage:/rails/storage`

### Background Jobs
- Uses Solid Queue integrated into Puma process in production (`SOLID_QUEUE_IN_PUMA=true`)
- Schema defined in `db/queue_schema.rb`
- Configuration in `config/queue.yml` and `config/recurring.yml`

### Frontend Stack
- **Hotwire**: Full SPA-like experience without separate frontend framework
- **Turbo**: Handles page navigation and updates
- **Stimulus**: JavaScript framework for controllers
- **Tailwind CSS**: Utility-first CSS framework with live reloading in development
- **Importmap**: ES modules without bundling

### Deployment
- **Kamal**: Zero-downtime Docker-based deployment
- **Thruster**: Production HTTP/2 proxy with caching and X-Sendfile support
- **Single server setup**: Web server at 192.168.0.1 (update in `config/deploy.yml`)
- **Docker image**: Built for amd64 architecture

## Code Style
- Follows **rubocop-rails-omakase** style guide (Rails default conventions)
- Configuration in `.rubocop.yml`
