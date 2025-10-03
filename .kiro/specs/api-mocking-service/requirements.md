# Requirements Document

## Introduction

The API mocking service is a self-hostable development tool that allows developers to create and manage mock APIs for testing and development purposes. The service provides a clean UI for creating mock endpoints and supports importing OpenAPI specifications. Each API can contain multiple endpoints with configurable scenarios for different response types, enabling developers to simulate various third-party API behaviors during development and QA phases.

## Requirements

### Requirement 1

**User Story:** As a developer, I want to create mock APIs through a web interface, so that I can quickly set up test endpoints without writing code.

#### Acceptance Criteria

1. WHEN a user accesses the web interface THEN the system SHALL display a dashboard with options to create new APIs
2. WHEN a user creates a new API THEN the system SHALL allow them to specify an API name and description
3. WHEN a user creates a new API THEN the system SHALL assign a unique port for that API
4. WHEN a user saves a new API THEN the system SHALL persist the API configuration and make it available for endpoint creation

### Requirement 2

**User Story:** As a developer, I want to import OpenAPI specifications, so that I can quickly mock entire APIs based on existing documentation.

#### Acceptance Criteria

1. WHEN a user uploads an OpenAPI JSON file THEN the system SHALL parse the specification and extract all endpoints
2. WHEN an OpenAPI file is processed THEN the system SHALL create a mock API with all defined endpoints
3. WHEN endpoints are created from OpenAPI THEN the system SHALL generate basic success scenarios for each endpoint based on the specification
4. IF an OpenAPI file contains invalid JSON THEN the system SHALL display an error message and reject the upload
5. WHEN an OpenAPI import is successful THEN the system SHALL allow the user to edit the generated endpoints and scenarios

### Requirement 3

**User Story:** As a developer, I want to create and configure individual endpoints within an API, so that I can define specific mock behaviors for different API paths.

#### Acceptance Criteria

1. WHEN a user selects an API THEN the system SHALL display a list of existing endpoints and an option to add new ones
2. WHEN a user creates an endpoint THEN the system SHALL require them to specify the HTTP method and path
3. WHEN a user creates an endpoint THEN the system SHALL allow them to define request headers, query parameters, and body requirements
4. WHEN a user saves an endpoint THEN the system SHALL validate that the path and method combination is unique within the API
5. IF a duplicate endpoint is created THEN the system SHALL display an error and prevent saving

### Requirement 4

**User Story:** As a developer, I want to configure multiple scenarios for each endpoint, so that I can test different response conditions including success and error cases.

#### Acceptance Criteria

1. WHEN a user selects an endpoint THEN the system SHALL display up to 3 configurable scenarios
2. WHEN a user configures a scenario THEN the system SHALL allow them to set the HTTP status code, response headers, and response body
3. WHEN a user configures a scenario THEN the system SHALL allow them to specify conditions for when this scenario should be triggered
4. WHEN a scenario is saved THEN the system SHALL validate that the response format is valid JSON if specified as JSON content type
5. WHEN multiple scenarios exist THEN the system SHALL provide a way to select which scenario to use as the default

### Requirement 5

**User Story:** As a developer, I want to test my mock endpoints, so that I can verify they return the expected responses before using them in my applications.

#### Acceptance Criteria

1. WHEN a user selects an endpoint THEN the system SHALL provide a test interface to send requests to that endpoint
2. WHEN a user sends a test request THEN the system SHALL display the response status, headers, and body
3. WHEN a user tests different scenarios THEN the system SHALL allow them to specify which scenario to trigger
4. WHEN a test is executed THEN the system SHALL log the request and response for debugging purposes
5. IF an endpoint is not properly configured THEN the system SHALL display appropriate error messages during testing

### Requirement 6

**User Story:** As a developer, I want my mock APIs to be accessible on dedicated ports, so that I can configure my applications to use specific mock endpoints.

#### Acceptance Criteria

1. WHEN an API is created THEN the system SHALL assign it a unique port number
2. WHEN a mock API is active THEN the system SHALL listen for HTTP requests on the assigned port
3. WHEN a request is received on an API's port THEN the system SHALL match the request path and method to the appropriate endpoint
4. WHEN a matching endpoint is found THEN the system SHALL return the configured response based on the active scenario
5. IF no matching endpoint is found THEN the system SHALL return a 404 Not Found response
6. WHEN an API is deactivated THEN the system SHALL stop listening on the assigned port

### Requirement 7

**User Story:** As a developer, I want to manage the lifecycle of my mock APIs, so that I can start, stop, and delete APIs as needed.

#### Acceptance Criteria

1. WHEN a user views the API dashboard THEN the system SHALL display the status (active/inactive) of each API
2. WHEN a user activates an API THEN the system SHALL start the mock server on the assigned port
3. WHEN a user deactivates an API THEN the system SHALL stop the mock server and free the port
4. WHEN a user deletes an API THEN the system SHALL remove all associated endpoints and scenarios
5. WHEN a user deletes an active API THEN the system SHALL first deactivate it before deletion
6. IF a port is already in use THEN the system SHALL display an error and suggest an alternative port

### Requirement 8

**User Story:** As a developer, I want to view logs and analytics for my mock APIs, so that I can understand how they are being used and debug issues.

#### Acceptance Criteria

1. WHEN requests are made to mock endpoints THEN the system SHALL log the request details including timestamp, method, path, headers, and body
2. WHEN responses are sent THEN the system SHALL log the response details including status code, headers, and body
3. WHEN a user views an API THEN the system SHALL display recent request logs for that API
4. WHEN a user views logs THEN the system SHALL provide filtering options by endpoint, status code, and time range
5. WHEN logs exceed a configurable limit THEN the system SHALL automatically archive or delete old entries