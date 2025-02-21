#include <iostream>
#include <vector>
#include <memory>

#include "server_worker.h"

std::shared_ptr<Grid> grid;

thread_local std::unordered_set<uWS::WebSocket<false, true, PointerToPlayer>*> thread_clients;
thread_local std::unordered_map<std::string, std::shared_ptr<GameObject>> thread_objects;

int main(int argc, char *argv[]) {
    int workers_num = 4;
    int grid_height = 1600, grid_width = 1600, grid_cell_size = 100;
    int port = 12345;

    std::vector<std::shared_ptr<ServerWorker>> workers;
    grid = std::make_shared<Grid>(grid_height, grid_width, grid_cell_size);

    for (int i = 0; i < workers_num; i++) {
        workers.push_back(std::make_shared<ServerWorker>());
        workers[i]->Start(port);
    }

    while (true) {
        std::this_thread::sleep_for(std::chrono::seconds(1));
    }

    return 0;
}
