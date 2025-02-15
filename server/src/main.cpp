#include <iostream>
#include <string>
#include <queue>
#include <chrono>
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

thread_local std::unordered_set<uWS::WebSocket<false, true, PointerToPlayer>*> thread_clients;
thread_local std::unordered_set<std::shared_ptr<GameObject>> thread_objects;

void HandleMessage(auto *ws, std::string_view str_message, uWS::OpCode opCode) {
    json message = json::parse(str_message);
    std::string type = message["type"];

    std::cout << message.dump(4) << std::endl;

    if (type == "ping") {
        // Retrieve the client's sent time.
        long long clientTime = message["clientTime"].get<long long>();

        // Get the server's current time.
        auto now = std::chrono::system_clock::now();
        auto serverTime = std::chrono::duration_cast<std::chrono::milliseconds>(
                              now.time_since_epoch()).count();

        // Build and send the pong message.
        json pongMsg = {
            {"type", "pong"},
            {"serverTime", serverTime},
            {"clientTime", clientTime}
        };
        ws->send(pongMsg.dump(), opCode);
        return;
    }
    // Handle join and movement messages as before.
    auto player_ptr = ws->getUserData()->player;  // shared_ptr<Player>
    
    if (type == "join") {
        player_ptr->set_id(message["id"].get<std::string>());
        player_ptr->set_x(message["position"]["x"].get<double>());
        player_ptr->set_y(message["position"]["y"].get<double>());
        grid->Insert(player_ptr);
    } else if (type == "movement") {
        if (message["objectType"] == "player") {
            double old_x = player_ptr->get_x();
            double old_y = player_ptr->get_y();
            player_ptr->set_x(message["position"]["x"].get<double>());
            player_ptr->set_y(message["position"]["y"].get<double>());
            grid->Update(player_ptr, old_x, old_y, 0);
        } else if (message["objectType"] == "snowball") {
            std::shared_ptr snowball_ptr = std::make_shared<Snowball>(message["id"], "snowball");
            thread_objects.insert(snowball_ptr);
            snowball_ptr->set_x(message["position"]["x"].get<double>());
            snowball_ptr->set_y(message["position"]["y"].get<double>());
            snowball_ptr->set_vx(message["velocity"]["x"].get<double>());
            snowball_ptr->set_vy(message["velocity"]["y"].get<double>());
            snowball_ptr->set_size(message["size"].get<double>());
            snowball_ptr->set_time_update(message["timeEmission"].get<long long>());
            snowball_ptr->set_life_length(message["lifeLength"].get<long long>());
            grid->Insert(snowball_ptr);
        }
    }
}

void UpdatePlayerView(auto *ws) {
    auto player_ptr = ws->getUserData()->player;
    double lower_y = player_ptr->get_y() - (constants::FIXED_VIEW_HEIGHT / 2);
    double upper_y = lower_y + constants::FIXED_VIEW_HEIGHT;
    double left_x = player_ptr->get_x() - (constants::FIXED_VIEW_WIDTH / 2);
    double right_x = left_x + constants::FIXED_VIEW_WIDTH;
    
    std::vector<std::shared_ptr<GameObject>> neighbors = grid->Search(lower_y, upper_y, left_x, right_x);
     
    for (auto obj : neighbors) {
        if (obj->get_id() != player_ptr->get_id()) {
            if (!obj->Collide(player_ptr)) {
                obj->SendMovementToClient(ws);
            }
        }
    }
}

void StartServer(int port) {
    uWS::App app = uWS::App()
        .ws<PointerToPlayer>("/*", {
            .open = [](auto *ws) {
                ws->getUserData()->player = std::make_shared<Player>();
                ws->getUserData()->player->set_type("player");
                thread_clients.insert(ws);
                std::cout << "Client connected!" << std::endl;
            },
            .message = [](auto *ws, std::string_view message, uWS::OpCode opCode) {
                HandleMessage(ws, message, opCode);
            },
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

    struct us_loop_t *loop = (struct us_loop_t *) uWS::Loop::get();
    struct us_timer_t *playerTimer = us_create_timer(loop, 0, 0);

    us_timer_set(playerTimer, [](struct us_timer_t * /*t*/) {
        for (auto *ws : thread_clients) {
            UpdatePlayerView(ws);
        }
    }, 20, 10);

    // Timer for snowball position updates (every 2000ms)
    struct us_timer_t *objectTimer = us_create_timer(loop, 0, 0);
    // Fix the timer callback:
    us_timer_set(objectTimer, [](struct us_timer_t * /*t*/) {
        // Create a copy of the set to avoid iterator invalidation
        auto objects_copy = thread_objects;
        
        for (const auto& obj : objects_copy) {
            if (obj) {  // Check if the pointer is valid
                // Check if object should be removed (e.g., snowball lifetime expired)
                auto now = std::chrono::system_clock::now();
                auto current_time = std::chrono::duration_cast<std::chrono::milliseconds>(
                    now.time_since_epoch()).count();
                    
                if (obj->get_time_update() + obj->get_life_length() < current_time) {
                    thread_objects.erase(obj);
                    continue;
                }
                grid->Update(obj, obj->get_x(), obj->get_y(), current_time);
            }
        }
    }, 250, 10);

    app.run();
}

int main() {
    grid = new Grid(1600, 1600, 100);
    StartServer(12345);
    std::cout << "Server stopped!" << std::endl;
    return 0;
}
