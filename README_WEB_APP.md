# CybSuite Frontend-Backend Connection

This setup connects the Django backend with the Next.js frontend, allowing seamless API communication between the two.

## Architecture

- **Backend**: Django REST Framework (Port 13371)
- **Frontend**: Next.js (Port 13370)
- **Database**: PostgreSQL (Port 13372)
- **API Communication**: RESTful API with CORS support
- **Deployment**: Docker containerized environment

## Quick Start

This application is designed to run in a containerized Docker environment.

### Services

- **Frontend**: Next.js application running on port 13370 with hot reload
- **Backend**: Django application running on port 13371 with auto-reload
- **Database**: PostgreSQL database running on port 13372

### Launch the Application

1. Build and start the services:
   ```bash
   docker-compose up --build
   ```

2. Access the applications:
   - Frontend: http://localhost:13370
   - Backend: http://localhost:13371
   - Database: PostgreSQL on localhost:13372

### Development Features

- **Hot Reload**: Both frontend and backend automatically reload when you make changes to the code
- **Volume Mounting**: Source code is mounted into containers for instant development feedback
- **Editable Install**: The cybsuite package is installed in editable mode (-e) for development

### Managing Docker Services

**Stopping Services:**
```bash
docker-compose down
```

**Rebuilding After Dependency Changes:**
If you modify `package.json` or `pyproject.toml`, rebuild the containers:
```bash
docker-compose build --no-cache
```

## Check Frontend-Backend Connection

Navigate to `http://localhost:13370/health_check` to verify the connection. You should see a health check status from the Django backend.

### Example API Usage in Frontend

```typescript
import { api } from './lib/api';
import { useApi } from './hooks/useApi';

// Using the custom hook
const { data, loading, error } = useApi(() => api.healthCheck(), []);

// Direct API calls
const response = await api.test.post({ message: 'Hello API!' });
```

## Configuration

### Environment Variables (Optional)

The application can run without any environment configuration, but you can optionally customize settings by creating `.env.docker` files.

#### Optional Frontend Configuration (`frontend/.env.docker`)
```env
DJANGO_API_URL=http://127.0.0.1:13371
NEXT_PUBLIC_API_URL=http://localhost:13371
NODE_ENV=development
NEXT_PUBLIC_ENABLE_DEBUG=true
```

#### Optional Backend Configuration (`backend/.env.docker`)
```env
DEV=true
DEBUG=true
SECRET_KEY="your-secret-key"
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0
CORS_ALLOWED_ORIGINS=http://localhost:13370,http://127.0.0.1:13370
ENABLE_TEST_ENDPOINTS=true
```

### Port Information

- **Frontend**: Port 13370
- **Backend**: Port 13371
- **Database**: Port 13372 (PostgreSQL)


### Access Among Network
To allow access among networked devices, ensure to export the host IP address in the environment, using the following command:
```bash
export NEXT_HOST_IP=192.168.x.x  # replace with your actual host IP
```

> The database won't be accessible from other machines but the host machine.
