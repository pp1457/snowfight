#ifndef GAME_OBJECT_H
#define GAME_OBJECT_H

#include <string>
#include <uWebSockets/App.h>

#include "nlohmann/json.hpp"

using json = nlohmann::json;

class GameObject {
    std::string type_, id_;
    double x_, y_, vx_, vy_, size_;
    int row_, col_;

public:
    GameObject() {}

    GameObject(std::string id, std::string type)
        : type_(std::move(type)), id_(std::move(id)), x_(0), y_(0), vx_(0), vy_(0), size_(1), row_(0), col_(0) {}

    // Getters
    std::string get_type() const { return type_; }
    std::string get_id() const { return id_; }
    double get_x() const { return x_; }
    double get_y() const { return y_; }
    double get_vx() const { return vx_; }
    double get_vy() const { return vy_; }
    double get_size() const { return size_; }
    int get_row() const { return row_; }
    int get_col() const { return col_; }

    // Setters
    void set_type(std::string type) { type_ = type; }
    void set_id(std::string id) { id_ = id; }
    void set_x(double x) { x_ = x; }
    void set_y(double y) { y_ = y; }
    void set_vx(double vx) { vx_ = vx; }
    void set_vy(double vy) { vy_ = vy; }
    void set_size(double size) { size_ = size; }
    void set_row(int row) { row_ = row; }
    void set_col(int col) { col_ = col; }

    bool Collide(std::shared_ptr<GameObject> obj) {
        return false;
//         double dx = x_ - obj.x_;
//         double dy = y_ - obj.y_;
//         double distance_squared = dx * dx + dy * dy;
//         double radius_sum = size_ / 2 + obj.size_ / 2;
//         return distance_squared <= radius_sum * radius_sum;
    }

    void SendMovementToClient(auto *ws) {
        json data = {
            {"type", "movement"},
            {"objectType", type_},
            {"position", {{"x", x_}, {"y", y_}}},
            {"velocity", {{"x", vx_}, {"y", vy_}}},
            {"size", size_}
        };

        ws->send(data.dump(), uWS::OpCode::TEXT);
    }
};


class Player : public GameObject {

public:
    Player() {

    }

};
#endif
