#include <boost/asio.hpp>
#include <boost/beast.hpp>
#include <boost/beast/websocket.hpp>
#include <iostream>
#include <thread>
#include <unordered_set>
#include <mutex>

namespace beast = boost::beast;            // Namespace for Boost.Beast
namespace http = beast::http;             // Namespace for HTTP
namespace websocket = beast::websocket;   // Namespace for WebSocket
namespace asio = boost::asio;             // Namespace for Boost.Asio
using tcp = boost::asio::ip::tcp;         // TCP namespace

std::mutex clients_mutex;
std::unordered_set<std::shared_ptr<websocket::stream<tcp::socket>>> clients;

void broadcast(const std::string& message) {
    std::lock_guard<std::mutex> lock(clients_mutex);
    for (auto& client : clients) {
        try {
            client->write(asio::buffer(message));
        } catch (const std::exception& e) {
            std::cerr << "Error sending message: " << e.what() << std::endl;
        }
    }
}

void handle_client(std::shared_ptr<websocket::stream<tcp::socket>> ws) {
    try {
        ws->accept();

        while (true) {
            beast::flat_buffer buffer;
            ws->read(buffer);

            // Parse received message
            std::string received = beast::buffers_to_string(buffer.data());
            std::cout << "Received: " << received << std::endl;

            // Broadcast the message to all clients
            broadcast(received);
        }
    } catch (const std::exception& e) {
        std::cerr << "Client disconnected: " << e.what() << std::endl;
    }

    // Remove client on disconnect
    {
        std::lock_guard<std::mutex> lock(clients_mutex);
        clients.erase(ws);
    }
}

int main() {
    try {
        asio::io_context io_context;
        tcp::acceptor acceptor(io_context, tcp::endpoint(tcp::v4(), 12345)); // Change port here if needed

        std::cout << "Server running on port 12345..." << std::endl;

        while (true) {
            auto socket = std::make_shared<tcp::socket>(io_context);
            acceptor.accept(*socket);

            auto ws = std::make_shared<websocket::stream<tcp::socket>>(std::move(*socket));
            {
                std::lock_guard<std::mutex> lock(clients_mutex);
                clients.insert(ws);
            }

            std::cout << "New client connected!" << std::endl;
            std::thread(&handle_client, ws).detach();
        }
    } catch (const std::exception& e) {
        std::cerr << "Server error: " << e.what() << std::endl;
    }

    return 0;
}
