# BalloonClient

A modern web application for managing balloon deliveries in competitive programming contests. This application provides real-time tracking and management of balloon deliveries to teams who solve problems during ICPC-style programming competitions.

## Overview

BalloonClient is a full-stack React application that connects to contest management systems to track problem submissions and manage balloon deliveries. It features a real-time dashboard for monitoring delivery status, team progress, and contest statistics.

## Features

### Core Functionality

- Real-time balloon delivery tracking and management
- Contest event monitoring through Server-Sent Events (SSE)
- Team performance analytics and statistics
- Problem-specific delivery status tracking
- First solve detection and special delivery handling

### User Interface

- Clean, modern UI built with React and Tailwind CSS
- Dark/light theme support with persistent preferences
- Responsive design for desktop and mobile devices
- Real-time updates without page refresh
- Intuitive dashboard with multiple view modes

### Technical Features

- TypeScript for enhanced code reliability and developer experience
- Component-based architecture with reusable UI elements
- State management with React Query for efficient data fetching
- Proxy server for secure contest API communication
- Comprehensive error handling and connection status monitoring

## Technology Stack

### Frontend

- **React 18** - Modern React with hooks and concurrent features
- **TypeScript** - Type-safe JavaScript development
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **React Router** - Client-side routing
- **React Query** - Server state management
- **Framer Motion** - Animation library
- **Luxon** - Date and time manipulation

### Backend

- **Node.js** - Server runtime
- **Express** - Web framework
- **Event Source Proxy** - Real-time event streaming

### Development Tools

- **SWC** - Fast TypeScript/JavaScript compiler
- **ESLint** - Code linting and formatting
- **Prettier** - Code formatting

## Prerequisites

Before running this application, ensure you have the following installed:

- Node.js (version 18 or higher)
- npm or yarn package manager
- A compatible contest management system with API access

## Installation

1. Clone the repository:

```bash
git clone https://github.com/qatadaazzeh/BalloonClient.git
cd BalloonClient
```

2. Install dependencies:

```bash
npm install
```

3. Install server dependencies:

```bash
cd server
npm install
cd ..
```

## Configuration

### Contest API Integration

The application connects to contest management systems through a proxy server that handles authentication and event streaming. Supported contest systems include:

- DOMjudge
- PC² (Programming Contest Control System)
- Kattis
- Other ICPC-compatible systems with REST APIs

## Usage

### Development Mode

To run the application in development mode:

```bash
# Start both client and proxy server
npm run dev:all

# Or start them separately
npm run dev        # Client only (port 8080)
npm run dev:proxy  # Proxy server only (port 3001)
```

The application will be available at `http://localhost:8080`

### Production Build

To build the application for production:

```bash
# Build both client and server
npm run build

# Or build separately
npm run build:client  # Client build
npm run build:server  # Server build
```

### Starting Production Server

```bash
npm start
```

## Project Structure

```
BalloonClient/
├── client/                 # Frontend React application
│   ├── components/         # Reusable UI components
│   │   ├── ui/            # Base UI components (buttons, cards, etc.)
│   │   ├── BalloonHeader.tsx
│   │   ├── BalloonLayout.tsx
│   │   └── ThemeProvider.tsx
│   ├── contexts/          # React contexts for state management
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility functions
│   ├── pages/             # Application pages/routes
│   └── App.tsx            # Main application component
├── server/                # Backend proxy server
│   ├── eventSourceProxy.js # SSE proxy for contest events
│   └── package.json       # Server dependencies
├── shared/                # Shared TypeScript types
│   └── balloonTypes.ts    # Balloon delivery interfaces
├── public/                # Static assets
├── dist/                  # Built application (generated)
└── configuration files    # Vite, TypeScript, Tailwind configs
```

## API Integration

### Contest Connection

The application connects to contest APIs through a proxy server that:

1. Authenticates with the contest system
2. Establishes Server-Sent Event streams
3. Forwards real-time contest events to the client
4. Handles API rate limiting and error recovery

### Data Models

Key data structures include:

- **BalloonDelivery**: Tracks individual balloon deliveries
- **Contest Events**: Real-time updates from contest systems
- **Team Progress**: Problem-solving statistics
- **Connection Status**: API connectivity monitoring

## Features in Detail

### Dashboard Views

- **Overview**: High-level contest statistics and delivery summary
- **Deliveries**: Detailed list of all balloon deliveries
- **Teams**: Team-specific progress and delivery history
- **Problems**: Problem-specific delivery tracking

### Delivery Management

- Automatic balloon assignment based on problem solutions
- Manual delivery confirmation and status updates
- Special handling for first solves and milestone achievements
- Delivery time tracking and performance metrics

### Real-time Updates

- Live contest event streaming
- Automatic UI updates without page refresh
- Connection status monitoring and recovery
- Event history and replay functionality

## Development

### Code Style

The project follows these conventions:

- TypeScript strict mode for type safety
- ESLint and Prettier for code formatting
- Component-based architecture with single responsibility
- Custom hooks for reusable logic
- Consistent naming conventions

### Type Checking

Verify TypeScript types:

```bash
npm run typecheck
```

### Code Formatting

Format code with Prettier:

```bash
npm run format.fix
```

## Deployment

### Production Deployment

1. Build the application:

```bash
npm run build
```

2. Deploy the `dist/` directory to your web server

3. Configure environment variables for production

4. Start the server:

```bash
npm start
```

### Docker Deployment

The application can be containerized using Docker. Create a `Dockerfile` based on the Node.js image and include the built application files.

## Troubleshooting

### Common Issues

**Connection Problems**

- Verify contest API credentials and URL
- Check network connectivity and firewall settings
- Review proxy server logs for authentication errors

**Build Errors**

- Ensure all dependencies are installed
- Verify Node.js version compatibility
- Check for TypeScript type errors

**Performance Issues**

- Monitor network requests and API response times
- Check browser console for JavaScript errors
- Verify event stream connectivity

### Logging

The application includes comprehensive logging for:

- Contest API connections
- Event stream status
- Delivery tracking
- Error conditions

## Contributing

When contributing to this project:

1. Follow the existing code style and conventions
2. Add TypeScript types for new functionality
3. Include tests for new features
4. Update documentation as needed
5. Test changes in both development and production builds

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Support

For support and questions:

1. Check the troubleshooting section above
2. Review the contest API documentation
3. Examine server logs for error details
4. Verify configuration and environment variables

## Acknowledgments

This project uses several open-source libraries and frameworks. Special thanks to the contributors of React, TypeScript, Tailwind CSS, and the broader web development community.
