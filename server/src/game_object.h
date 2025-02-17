#ifndef GAME_OBJECT_H
#define GAME_OBJECT_H

#include <algorithm>
#include <string>
#include <chrono>
#include <memory>
#include <uWebSockets/App.h>
#include "nlohmann/json.hpp"

using json = nlohmann::json;

class Player;

struct PointerToPlayer {
    std::shared_ptr<Player> player;
};

class GameObject {
    std::string type_, id_;
    double x_, y_, vx_, vy_, size_;
    int row_, col_, health_, damage_;
    long long time_update_; // Time when the object was emitted
    long long life_length_;  // Lifespan of the object in milliseconds

public:
    GameObject() : time_update_(0), life_length_(0) {}

    GameObject(std::string id, std::string type)
        : type_(std::move(type)), id_(std::move(id)), x_(0), y_(0), vx_(0), vy_(0), size_(1), row_(0), col_(0), time_update_(0), life_length_(0) {}

    virtual ~GameObject() = default;

    // Getters and Setters

    std::string get_type() { return type_; }
    std::string get_id() { return id_; }
    double get_x() const { return x_; }
    double get_y() const { return y_; }
    virtual double get_cur_x(long long current_time) const { return x_; }
    virtual double get_cur_y(long long current_time) const { return y_; }
    double get_vx() const { return vx_; }
    double get_vy() const { return vy_; }
    double get_size() const { return size_; }
    int get_row() const { return row_; }
    int get_col() const { return col_; }
    int get_health() const { return health_; }
    int get_damage() const { return damage_; }
    long long get_time_update() const { return time_update_; }
    long long get_life_length() const { return life_length_; }

    void set_type(std::string type) { type_ = type; }
    void set_id(std::string id) { id_ = id; }
    void set_x(double x) { x_ = x; }
    void set_y(double y) { y_ = y; }
    void set_vx(double vx) { vx_ = vx; }
    void set_vy(double vy) { vy_ = vy; }
    void set_size(double size) { size_ = size; }
    void set_row(int row) { row_ = row; }
    void set_col(int col) { col_ = col; }
    void set_health(int health) { health_ =  health; }
    void set_damage(int damage) { damage_ =  damage; }
    void set_time_update(long long time_update) { time_update_ = time_update; }
    void set_life_length(long long life_length) { life_length_ = life_length; }

    bool Expired(long long current_time) {
        long long elapsed_time = current_time - get_time_update();
        if (elapsed_time > get_life_length()) return true;
        return false;
    }

    bool Collide(std::shared_ptr<GameObject> obj) {
        if (get_life_length() < 0) return false;
        auto now = std::chrono::system_clock::now();
        auto current_time = std::chrono::duration_cast<std::chrono::milliseconds>(
            now.time_since_epoch()).count();
        double x_diff = obj->get_cur_x(current_time) - get_cur_x(current_time);
        double y_diff = obj->get_cur_y(current_time) - get_cur_y(current_time);
        double distance_square = x_diff * x_diff + y_diff * y_diff;
        double size_sum = obj->get_size() + get_size();
        if (distance_square < (size_sum * size_sum)) {
            set_life_length(-1);
            return true;
        }
        return false;
    }

    void Hurt(int damage) {
        std::cout << "Ahhhhh!\n";
        set_health(std::max(get_health() - damage, 0));
    }

    // Non-template version of SendMovementToClient
    virtual void SendMovementToClient(uWS::WebSocket<false, true, PointerToPlayer> *ws) {
        json data = {
            {"id", get_id()},
            {"type", "movement"},
            {"objectType", get_type()},
            {"position", {{"x", get_cur_x(0)}, {"y", get_cur_y(0)}}},
            {"velocity", {{"x", get_vx()}, {"y", get_vy()}}}, 
            {"size", get_size()},
            {"newHealth", get_health()}
        };

        ws->send(data.dump(), uWS::OpCode::TEXT);
    }

    virtual void SendStatusToClient(uWS::WebSocket<false, true, PointerToPlayer> *ws) {
        json data = {
            {"id", get_id()},
            {"type", "hit"},
            {"objectType", get_type()},
            {"position", {{"x", get_cur_x(0)}, {"y", get_cur_y(0)}}},
            {"velocity", {{"x", get_vx()}, {"y", get_vy()}}}, 
            {"size", get_size()},
            {"newHealth", get_health()}
        };

        ws->send(data.dump(), uWS::OpCode::TEXT);
    }
};

class Player : public GameObject {
};

class Snowball : public GameObject {
private:
    bool charging_;
public:
    bool get_charging() { return charging_; }
    void set_charging(bool charging) { charging_ = charging; }
    Snowball(const std::string& id, const std::string& type)
            : GameObject(id, type) {}

    double get_cur_x(long long current_time) const override {
        long long elapsed_time = current_time - get_time_update();
        return get_x() + get_vx() * (elapsed_time / 1000.0);
    }

    double get_cur_y(long long current_time) const override {
        long long elapsed_time = current_time - get_time_update();
        return get_y() + get_vy() * (elapsed_time / 1000.0);
    }

    // Override the non-template SendMovementToClient
    void SendMovementToClient(uWS::WebSocket<false, true, PointerToPlayer> *ws) override {
        auto now = std::chrono::system_clock::now();
        auto current_time = std::chrono::duration_cast<std::chrono::milliseconds>(
            now.time_since_epoch()).count();
        json data = {
            {"id", get_id()},
            {"type", "movement"},
            {"objectType", get_type()},
            {"position", {{"x", get_cur_x(current_time)}, {"y", get_cur_y(current_time)}}},
            {"velocity", {{"x", get_vx()}, {"y", get_vy()}}},
            {"size", get_size()},
            {"charging", get_charging()},
            {"deathDate", current_time + get_life_length()}
        };

        ws->send(data.dump(), uWS::OpCode::TEXT);
    }

};

#endif
