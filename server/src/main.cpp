#include <uWebSockets/App.h>
#include <iostream>

#include "nlohmann/json.hpp"

using json = nlohmann::json;

// Define the UserData struct (even if empty, it must be present)
struct UserData {};

void handle_message(std::string_view str_message, uWS::OpCode opCode) {
    json message = json::parse(str_message);
    std::string type = message["type"];
    if (type == "move") {
        std::cout << "move!" << std::endl;
    } else if (type == "fire") {
        std::cout << "fire!" << std::endl;
    }

    // std::cout << message.dump(4) << std::endl;
}

void start_server(int port) {
    uWS::App()
        .ws<UserData>("/*", {
            .open = [](auto *ws) {
                std::cout << "Client connected!" << std::endl;
            },
            .message = [](auto *ws, std::string_view message, uWS::OpCode opCode) {
                // std::cout << "Received message: " << message << std::endl;
                handle_message(message, opCode);
                // ws->send("Echo: " + std::string(message), opCode);
            },
            .close = [](auto *ws, int code, std::string_view message) {
                std::cout << "Client disconnected!" << std::endl;
            }
        })
        .listen(port, [&](auto *listenSocket) {
            if (listenSocket) {
                std::cout << "Listening on port " << port << std::endl;
            } else {
                std::cerr << "Failed to start the server" << std::endl;
            }
        })
        .run();
}

int main() {
    // Create the WebSocket server
    start_server(12345);
    std::cout << "Server stopped!" << std::endl;
    return 0;
}
