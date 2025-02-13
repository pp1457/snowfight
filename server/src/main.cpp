#include <iostream>
#include <queue>
#include <time.h>
#include <uWebSockets/App.h>

#include "nlohmann/json.hpp"

#include "game_object.h"
#include "constants.h"

using json = nlohmann::json;

void HandleMessage(auto *ws, std::string_view str_message, uWS::OpCode opCode) {

    Player *player = ws;
    json message = json::parse(str_message);
    std::string type = message["type"];

    if (type == "join") {
        ws->getUserData()->set_id(message["id"]);
    } else if (type == "move") {
        std::cout << "move!" << std::endl;
    } else if (type == "fire") {
        std::cout << "fire!" << std::endl;
    }

    // std::cout << message.dump(4) << std::endl;
}

void UpdatePlayerView(auto *ws) {
 
    Player *player = ws->getUserData();
 
    // Calculate view boundaries based on player position (y for row, x for column)
    double lower_y = player->get_y() - (constants::FIXED_VIEW_HEIGHT / 2);
    double upper_y = lower_y + constants::FIXED_VIEW_HEIGHT;
    double left_x = player->get_x() - (constants::FIXED_VIEW_WIDTH / 2);
    double right_x = left_x + constants::FIXED_VIEW_WIDTH;
     
    // Search for objects within the player's view
    for (auto obj : grid->Search(lower_y, upper_y, left_x, right_x)) {
        if (!obj->Collide(player)) {
            obj->SendMovementData(ws);
        }
    }
}

thread_local std::unordered_set<uWS::WebSocket<false, true, Player>*> thread_clients;

void StartServer(int port, int thread_id) {
    // Create the app
    uWS::App app = uWS::App()
        .ws<Player>("/*", {
            .open = [](auto *ws) {
                // Insert the client into the thread-local set for this thread
                thread_clients.insert(ws);
                std::cout << "Client connected!" << std::endl;
            },
            .message = [](auto *ws, std::string_view message, uWS::OpCode opCode) {
                std::cout << "Received message: " << message << std::endl;
                // Handle message
            },
            .close = [](auto *ws, int code, std::string_view message) {
                // Remove the client from the thread-local set for this thread
                thread_clients.erase(ws);
                std::cout << "Client disconnected!" << std::endl;
            }
        }).listen(port, [&](auto *listenSocket) {
            if (listenSocket) {
                std::cout << "Listening on port " << port << std::endl;
            } else {
                std::cerr << "Failed to start the server" << std::endl;
            }
        });

    // Get the loop instance
    struct us_loop_t *loop = (struct us_loop_t *) uWS::Loop::get();

    // Create a timer for each thread (each thread has its own timer)
    struct us_timer_t *delayTimer = us_create_timer(loop, 0, sizeof(thread_clients));

    // Set the timer to call the callback every 8 milliseconds
    us_timer_set(delayTimer, [](struct us_timer_t *t) {
        // Retrieve the thread-local clients set
        // Here, we don't need to pass thread_id because we can directly access the thread-local variable
        for (auto *ws : thread_clients) {
            // Update player view or perform other operations
            // std::cout << "Updating player view for a client." << std::endl;
            UpdatePlayerView(ws); // Add your custom logic here
        }
    }, 10, 1000); // 8 milliseconds

    // Run the app
    app.run();
}

int main() {
    // Create the WebSocket server
    StartServer(12345, 0);
    std::cout << "Server stopped!" << std::endl;
    return 0;
}
