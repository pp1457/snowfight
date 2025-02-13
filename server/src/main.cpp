#include <iostream>
#include <string>
#include <queue>
#include <time.h>
#include <uWebSockets/App.h>
#include <unordered_set>
#include <memory>
#include "nlohmann/json.hpp"

#include "grid.h"
#include "game_object.h"    // Assumed to contain Player & Grid definitions
#include "constants.h"

using json = nlohmann::json;

// Global grid pointer
Grid *grid = nullptr;

// Structure that will be stored as the WebSocket user data,
// containing a shared_ptr to a Player.
struct PointerToPlayer {
    std::shared_ptr<Player> player;
};

// Modified HandleMessage function
void HandleMessage(auto *ws, std::string_view str_message, uWS::OpCode opCode) {
    // Retrieve the shared pointer from user data
    auto player_ptr = ws->getUserData()->player;  // shared_ptr<Player>
    
    json message = json::parse(str_message);
    std::string type = message["type"];

    std::cout << "handle begin\n" << message.dump(4) << std::endl;

    if (type == "join") {
        // Update the player's state
        player_ptr->set_id(message["id"].get<std::string>());  // Treat id as a string

        player_ptr->set_x(message["position"]["x"].get<double>());
        player_ptr->set_y(message["position"]["y"].get<double>());

        // Insert the shared_ptr into the grid (assuming grid->Insert accepts shared_ptr<Player>)
        grid->Insert(player_ptr);
    } else if (type == "movement") {
        if (message["objectType"] == "player") {
            // std::cout << "move!" << std::endl;
            double old_x = player_ptr->get_x();
            double old_y = player_ptr->get_y();
            player_ptr->set_x(message["position"]["x"].get<double>());
            player_ptr->set_y(message["position"]["y"].get<double>());
            grid->Update(player_ptr, old_x, old_y);
        }
    } else if (type == "fire") {
        // std::cout << "fire!" << std::endl;
    }

    // std::cout << "handle end\n" << message.dump(4) << std::endl;

    // Optionally print the message:
    // std::cout << message.dump(4) << std::endl;
}
void UpdatePlayerView(auto *ws) {
    // Retrieve the shared_ptr from the user data.
    auto player_ptr = ws->getUserData()->player;

    // Calculate view boundaries based on the player's position.
    double lower_y = player_ptr->get_y() - (constants::FIXED_VIEW_HEIGHT / 2);
    double upper_y = lower_y + constants::FIXED_VIEW_HEIGHT;
    double left_x = player_ptr->get_x() - (constants::FIXED_VIEW_WIDTH / 2);
    double right_x = left_x + constants::FIXED_VIEW_WIDTH;
    
    std::vector<std::shared_ptr<GameObject>> neighbors = grid->Search(lower_y, upper_y, left_x, right_x);

    // if (neighbors.size()) {
    //     std::cout << "size: " << neighbors.size() << std::endl;
    // }
     
    // Search for objects within the player's view.
    for (auto obj : neighbors) if (obj->get_id() != player_ptr->get_id()) {
        // Use the raw pointer from the shared_ptr for collision check.
        if (!obj->Collide(player_ptr)) {
            obj->SendMovementToClient(ws);
        }
    }
}

// A thread-local set to keep track of connected clients.
thread_local std::unordered_set<uWS::WebSocket<false, true, PointerToPlayer>*> thread_clients;

void StartServer(int port, int thread_id) {
    // Create the app using PointerToPlayer as the user data type.
    uWS::App app = uWS::App()
        .ws<PointerToPlayer>("/*", {
            // open callback: allocate the Player and store it in the user data.
            .open = [](auto *ws) {
                ws->getUserData()->player = std::make_shared<Player>();
                ws->getUserData()->player->set_type("player");
                thread_clients.insert(ws);
                std::cout << "Client connected!" << std::endl;
            },
            // message callback: handle messages from the client.
            .message = [](auto *ws, std::string_view message, uWS::OpCode opCode) {
                HandleMessage(ws, message, opCode);
            },
            // close callback: remove the client from the set.
            .close = [](auto *ws, int code, std::string_view message) {
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

    // Get the loop instance from uWebSockets.
    struct us_loop_t *loop = (struct us_loop_t *) uWS::Loop::get();

    // Create a timer for the thread.
    struct us_timer_t *delayTimer = us_create_timer(loop, 0, sizeof(thread_clients));

    us_timer_set(delayTimer, [](struct us_timer_t *t) {
        for (auto *ws : thread_clients) {
            UpdatePlayerView(ws);
        }
    }, 1000, 10);

    // Run the app
    app.run();
}

int main() {
    // Create the grid (parameters based on your Grid constructor)
    grid = new Grid(8000, 8000, 100);
    
    // Start the server on port 12345.
    StartServer(12345, 0);
    
    std::cout << "Server stopped!" << std::endl;
    return 0;
}
