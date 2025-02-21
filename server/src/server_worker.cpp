#include "server_worker.h"

using json = nlohmann::json;

ServerWorker::ServerWorker() {}

// Sends a pong response for a "ping" message.
void ServerWorker::handlePing(auto *ws, const json &message, uWS::OpCode opCode) {
    long long clientTime = message.value("clientTime", 0LL);
    auto now = std::chrono::system_clock::now();
    auto serverTime = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();

    json pongMsg = {
        {"messageType", "pong"},
        {"serverTime", serverTime},
        {"clientTime", clientTime}
    };

    ws->send(pongMsg.dump(), opCode);
}

// Processes a "join" message.
void ServerWorker::handleJoin(auto * /*ws*/, const json &message, std::shared_ptr<Player> player_ptr) {
    // Set the player's ID and attributes using default values if keys are missing.
    player_ptr->set_id(message.value("id", "unknown"));

    double x = 0.0, y = 0.0;
    int health = message.value("health", 100);
    double size = message.value("size", 20.0);

    // Extract position if provided.
    if (message.contains("position") &&
        message["position"].contains("x") &&
        message["position"].contains("y")) {
        x = message["position"]["x"].get<double>();
        y = message["position"]["y"].get<double>();
    }

    player_ptr->set_health(health);
    player_ptr->set_x(x);
    player_ptr->set_y(y);
    player_ptr->set_size(size);

    // Insert the player into the grid.
    grid->Insert(player_ptr);
}

// Processes a "movement" message.
void ServerWorker::handleMovement(auto * /*ws*/, const json &message, std::shared_ptr<Player> player_ptr) {
    if (!message.contains("objectType")) return;
    if (message["objectType"] == "player") {
        // Handle player movement.
        double new_x = player_ptr->get_x();
        double new_y = player_ptr->get_y();

        if (message.contains("position") &&
            message["position"].contains("x") &&
            message["position"].contains("y")) {
            new_x = message["position"]["x"].get<double>();
            new_y = message["position"]["y"].get<double>();
        }

        player_ptr->set_x(new_x);
        player_ptr->set_y(new_y);
        grid->Update(player_ptr, 0);
    } else if (message["objectType"] == "snowball") {
        // Handle snowball movement.
        std::string snowball_id = message.value("id", "unknown");
        bool is_new = false;
        std::shared_ptr<Snowball> snowball_ptr;

        if (!thread_objects.count(snowball_id)) {
            snowball_ptr = std::make_shared<Snowball>(snowball_id, "snowball");
            thread_objects[snowball_id] = snowball_ptr;
            is_new = true;
        }
        else {
            snowball_ptr = std::static_pointer_cast<Snowball>(thread_objects[snowball_id]);
        }

        // std::cout << "thread_object's size: " << thread_objects_.size() << std::endl;

        double x = 0.0, y = 0.0, vx = 0.0, vy = 0.0;
        double size = message.value("size", 1.0);
        long long time_update = message.value("timeEmission", 0LL);
        long long life_length = message.value("lifeLength", static_cast<long long>(4e18));
        int damage = message.value("damage", 5);
        bool charging = message.value("charging", false);

        if (message.contains("position") &&
            message["position"].contains("x") &&
            message["position"].contains("y")) {
            x = message["position"]["x"].get<double>();
            y = message["position"]["y"].get<double>();
        }
        if (message.contains("velocity") &&
            message["velocity"].contains("x") &&
            message["velocity"].contains("y")) {
            vx = message["velocity"]["x"].get<double>();
            vy = message["velocity"]["y"].get<double>();
        }

        snowball_ptr->set_x(x);
        snowball_ptr->set_y(y);
        snowball_ptr->set_vx(vx);
        snowball_ptr->set_vy(vy);
        snowball_ptr->set_size(size);
        snowball_ptr->set_time_update(time_update);
        snowball_ptr->set_life_length(life_length);
        snowball_ptr->set_charging(charging);
        snowball_ptr->set_damage(damage);

        if (is_new) {
            grid->Insert(snowball_ptr);
        }
    }
}

//------------------------------------------------------------------------------
// Refactored HandleMessage implementation
//------------------------------------------------------------------------------
void ServerWorker::HandleMessage(auto *ws, std::string_view str_message, uWS::OpCode opCode) {
    json message = json::parse(str_message);
    std::string type = message.value("type", "");

    std::cout << message.dump(4) << std::endl;

    // Handle ping separately.
    if (type == "ping") {
        handlePing(ws, message, opCode);
        return;
    }

    // Retrieve the player's pointer from user data.
    auto player_ptr = ws->getUserData()->player;

    if (type == "join") {
        handleJoin(ws, message, player_ptr);
    }
    else if (type == "movement") {
        handleMovement(ws, message, player_ptr);
    }
}

//------------------------------------------------------------------------------
// Minimal implementations for Start, UpdatePlayerView, StartServer, and main.
// Adjust these as needed for your application.
//

void ServerWorker::Start(int port) {
    worker_thread_ = std::thread(&ServerWorker::StartServer, this, port);
}

std::string ExtractPlayerId(const std::string& snowballId) {
    size_t firstUnderscore = snowballId.find('_');
    size_t secondUnderscore = snowballId.find('_', firstUnderscore + 1);

    if (firstUnderscore == std::string::npos || secondUnderscore == std::string::npos) {
        return "not_snowball";
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
            if (obj->get_damage() && ExtractPlayerId(obj->get_id()) != player_ptr->get_id() &&
                obj->Collide(player_ptr)) {
                player_ptr->Hurt(ws, obj->get_damage());
            } else {
                obj->SendMessageToClient(ws, "movement");
            }
        }
    }
}

void HandleThreadClients(struct us_timer_t * /*t*/) {
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
}
void HandleThreadObjects(struct us_timer_t * /*t*/) {
    auto objects_copy = thread_objects;
    
    for (auto &[id, obj] : objects_copy) {
        if (obj) { 
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
}

void ServerWorker::StartServer(int port) {
    uWS::App app = uWS::App()
        .ws<PointerToPlayer>("/*", {
            .open = [](auto *ws) {
                ws->getUserData()->player = std::make_shared<Player>();
                ws->getUserData()->player->set_type("player");
                thread_clients.insert(ws);
                std::cout << "Client connected!" << std::endl;
            },
            .message = [this](auto *ws, std::string_view message, uWS::OpCode opCode) {
                HandleMessage(ws, message, opCode);
            },
            .close = [](auto *ws, int /*code*/, std::string_view /*message*/) {
                grid->Remove(ws->getUserData()->player);
                thread_clients.erase(ws);
                std::cout << "Client disconnected!" << std::endl;
            }
        }).listen(port, [&](auto *listenSocket) {
            if (listenSocket) {
                // std::cout << "Listening on port " << port << std::endl;
            } else {
                std::cerr << "Failed to start the server" << std::endl;
            }
        });

    struct us_loop_t *loop = (struct us_loop_t *) uWS::Loop::get();
    struct us_timer_t *playerTimer = us_create_timer(loop, 0, 0);

    us_timer_set(playerTimer, HandleThreadClients, 20, 10);

    // Timer for snowball position updates (every 2000ms)
    struct us_timer_t *objectTimer = us_create_timer(loop, 0, 0);
    // Fix the timer callback:
    us_timer_set(objectTimer, HandleThreadObjects, 250, 10);

    app.run();
}
