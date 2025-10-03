# Product Overview

An API mocking service which returns user defined payloads from a mocked third party API.

## Goals

The aim of the project is to provide a self-hostable service for developers to use when developing their projects.

The service should have the option to create mocked APIs via a clean, simple to use UI, and I should also have the option to load from openAPI specs as json.

Each mocked API can contain many endpoints, and each endpoint can contain up to 3 scenarios - scenarios can be configured when the developer wants to force a success or error response, or different response payloads.

If an api is loaded from an OpenAPI json file, then the entire API should be created along with all of the endpoints with a basic success scenario for each. The user should then have the option to edit each endpoint or scenario to fine tune the responses.

Once an API is created - either via OpenAPI load or via the UI - then the user should be able to test out the scenarios to ensure they're working as expected. 

## Use cases

The use case of the service is where a system relies on third party integrations to function, e.g. an internal process sends requests to a third party API and uses the response to continue processing.
This service serves as a stand in during development and QA and provides consistent and controllable responses to be sent when requests are made to the third party API.

## Example

Say I anm developing a system which calls out to https://acme-corp.api.net to retrieve a list of 'products'.
Based on their OpenAPI docs, my system would need to send a GET request to their API endpoint at '/products' and I would receive back a list of products.

This mocking service needs to be able to mock that process, and provide a way of listening for the same request and responding with a user-defined response which matches what is defined in their documentation.

## Considerations

One way to achieve the goals of this project would be to have each mocked api available on a dedicated port. 
This way, requests can be sent to the server at the corresponding port, with a path that matches the API spec, and the service will return the configured response.

## Development Principles
- Write clean, maintainable code
- Prioritize user experience and accessibility
- Follow security best practices
- Implement proper error handling and logging