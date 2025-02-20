#include <iostream>
#include <string>
#include <queue>
#include <chrono>
#include <uWebSockets/App.h>
#include <unordered_set>
#include <memory>
#include "nlohmann/json.hpp"

#include "grid.h"
#include "game_object.h"
#include "constants.h"


using json = nlohmann::json;

// Global grid pointer
Grid *grid = nullptr;

thread_local std::unordered_set<uWS::WebSocket<false, true, PointerToPlayer>*> thread_clients;
thread_local std::unordered_map<std::string, std::shared_ptr<GameObject>> thread_objects;

void HandleMessage(auto *ws, std::string_view str_message, uWS::OpCode opCode) {
    json message = json::parse(str_message);
    std::string type = message["type"];

    std::cout << message.dump(4) << std::endl;

    if (type == "ping") {
        // Retrieve the client's sent time.
        long long clientTime = message["clientTime"].get<long long>();

        // Get the server's current time.
        auto now = std::chrono::system_clock::now();
        auto serverTime = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();

        // Build and send the pong message.
        json pongMsg = {
            {"messageType", "pong"},
            {"serverTime", serverTime},
            {"clientTime", clientTime}
        };
        ws->send(pongMsg.dump(), opCode);
        return;
    }

    // Handle join and movement messages as before.
    auto player_ptr = ws->getUserData()->player;  // shared_ptr<Player>
    
    if (type == "join") {
        player_ptr->set_id(message.contains("id") ? message["id"].get<std::string>() : "unknown");

        int default_health = 100;
        double default_x = 0.0, default_y = 0.0, default_size = 20;

        if (message.contains("position") && message["position"].contains("x") && message["position"].contains("y")) {
            default_x = message["position"]["x"].get<double>();
            default_y = message["position"]["y"].get<double>();
        }

        if (message.contains("health")) default_health = message["health"].get<int>();
        if (message.contains("size")) default_health = message["size"].get<int>();

        player_ptr->set_health(default_health);
        player_ptr->set_x(default_x);
        player_ptr->set_y(default_y);
        player_ptr->set_size(default_size);

        grid->Insert(player_ptr);

    } else if (type == "movement") {
        if (message.contains("objectType") && message["objectType"] == "player") {
            double old_x = player_ptr->get_x();
            double old_y = player_ptr->get_y();

            double new_x = old_x, new_y = old_y;
            if (message.contains("position") && message["position"].contains("x") && message["position"].contains("y")) {
                new_x = message["position"]["x"].get<double>();
                new_y = message["position"]["y"].get<double>();
            }
            player_ptr->set_x(new_x);
            player_ptr->set_y(new_y);

            grid->Update(player_ptr, 0);
        } else if (message.contains("objectType") && message["objectType"] == "snowball") {

            bool is_new = false;

            std::string snowball_id = message.contains("id") ? message["id"].get<std::string>() : "unknown";
            std::shared_ptr<Snowball> snowball_ptr;

            if (!thread_objects.count(snowball_id)) {
                snowball_ptr = std::make_shared<Snowball>(snowball_id, "snowball");
                thread_objects[snowball_id] = snowball_ptr;
                is_new = true;
            } else {
                snowball_ptr = std::static_pointer_cast<Snowball>(thread_objects[snowball_id]);
            }

            std::cout << "thread_object's size: " << thread_objects.size() << std::endl;

            double default_x = 0.0, default_y = 0.0, default_vx = 0.0, default_vy = 0.0, default_size = 1.0;
            long long default_time_update = 0, default_life_length = 4e18;
            int default_damage = 5;
            bool default_charging = false;

            if (message.contains("position") && message["position"].contains("x") && message["position"].contains("y")) {
                default_x = message["position"]["x"].get<double>();
                default_y = message["position"]["y"].get<double>();
            }

            if (message.contains("velocity") && message["velocity"].contains("x") && message["velocity"].contains("y")) {
                default_vx = message["velocity"]["x"].get<double>();
                default_vy = message["velocity"]["y"].get<double>();
            }

            if (message.contains("size")) default_size = message["size"].get<double>();
            if (message.contains("timeEmission")) default_time_update = message["timeEmission"].get<long long>();
            if (message.contains("lifeLength")) default_life_length = message["lifeLength"].get<long long>();
            if (message.contains("charging")) default_charging = message["charging"].get<bool>();
            if (message.contains("damage")) default_damage = message["damage"].get<int>();

            snowball_ptr->set_x(default_x);
            snowball_ptr->set_y(default_y);
            snowball_ptr->set_vx(default_vx);
            snowball_ptr->set_vy(default_vy);
            snowball_ptr->set_size(default_size);
            snowball_ptr->set_time_update(default_time_update);
            snowball_ptr->set_life_length(default_life_length);
            snowball_ptr->set_charging(default_charging);
            snowball_ptr->set_damage(default_damage);

            if (is_new) {
                grid->Insert(snowball_ptr);
            } 
        }
    }
}

std::string ExtractPlayerId(const std::string& snowballId) {
    size_t firstUnderscore = snowballId.find('_');
    size_t secondUnderscore = snowballId.find('_', firstUnderscore + 1);

    if (firstUnderscore == std::string::npos || secondUnderscore == std::string::npos) {
        return "not_snowball";
        // throw std::invalid_argument("Invalid snowball ID format");
    }

    return snowballId.substr(firstUnderscore + 1, secondUnderscore - firstUnderscore - 1);
}

void UpdatePlayerView(auto *ws, auto player_ptr) {

    double lower_y = player_ptr->get_y() - (constants::FIXED_VIEW_HEIGHT);
    double upper_y = lower_y + 2 * constants::FIXED_VIEW_HEIGHT;
    double left_x = player_ptr->get_x() - (constants::FIXED_VIEW_WIDTH);
    double right_x = left_x + 2 * constants::FIXED_VIEW_WIDTH;
    
    std::vector<std::shared_ptr<GameObject>> neighbors = grid->Search(lower_y, upper_y, left_x, right_x);

     
    for (auto obj : neighbors) {
        if (obj->get_id() != player_ptr->get_id()) {
            if (obj->get_type() == "snowball" && ExtractPlayerId(obj->get_id()) != player_ptr->get_id() && obj->Collide(player_ptr)) {
                player_ptr->Hurt(obj->get_damage());
                player_ptr->SendMessageToClient(ws, "hit");
            } else {
                obj->SendMessageToClient(ws, "movement");
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
            .close = [](auto *ws, int /*code*/, std::string_view /*message*/) {
                grid->Remove(ws->getUserData()->player);
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
    
        auto clients_copy = thread_clients;
        for (auto *ws : clients_copy) {
            auto player_ptr = ws->getUserData()->player;
            if (player_ptr->get_is_dead()) {
                grid->Remove(player_ptr);
                thread_clients.erase(ws);
                return;
            }
            UpdatePlayerView(ws, player_ptr);
        }
    }, 20, 10);

    // Timer for snowball position updates (every 2000ms)
    struct us_timer_t *objectTimer = us_create_timer(loop, 0, 0);
    // Fix the timer callback:
    us_timer_set(objectTimer, [](struct us_timer_t * /*t*/) {
        // Create a copy of the set to avoid iterator invalidation
        auto objects_copy = thread_objects;
        
        for (auto &[id, obj] : objects_copy) {
            if (obj) {  // Check if the pointer is valid
                // Check if object should be removed (e.g., snowball lifetime expired)
                auto now = std::chrono::system_clock::now();
                auto current_time = std::chrono::duration_cast<std::chrono::milliseconds>(
                    now.time_since_epoch()).count();
                    
                if (obj->get_is_dead()) {
                    thread_objects.erase(id);
                } else if (obj->Expired(current_time)) {
                    thread_objects.erase(id);
                    grid->Remove(obj);
                } else {
                    grid->Update(obj, current_time);
                }
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
