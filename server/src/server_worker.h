#ifndef server_worker_h
#define server_worker_h

#include <iostream>
#include <string>
#include <chrono>
#include <uWebSockets/App.h>
#include <unordered_set>
#include <memory>
#include <thread>

#include "nlohmann/json.hpp"

#include "grid.h"
#include "game_object.h"
#include "constants.h"

extern std::shared_ptr<Grid> grid;

extern thread_local std::unordered_set<uWS::WebSocket<false, true, PointerToPlayer>*> thread_clients;
extern thread_local std::unordered_map<std::string, std::shared_ptr<GameObject>> thread_objects;

class ServerWorker {
    std::thread worker_thread_;
public:
    ServerWorker();
    void Start(int port);
protected:
    void StartServer(int port);

    void HandleMessage(auto *ws, std::string_view str_message, uWS::OpCode opCode);

    void handlePing(auto *ws, const json &message, uWS::OpCode opCode);
    void handleJoin(auto *ws, const json &message, std::shared_ptr<Player> player_ptr);
    void handleMovement(auto *ws, const json &message, std::shared_ptr<Player> player_ptr);
};

#endif
