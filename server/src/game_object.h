#ifndef GAME_OBJECT_H
#define GAME_OBJECT_H

#include <string>
#include <memory>
#include <chrono>
#include "nlohmann/json.hpp"
#include <uWebSockets/App.h>

using json = nlohmann::json;

class Player;

struct PointerToPlayer {
    std::shared_ptr<Player> player;
};

class GameObject {
public:
    // Constructors and destructor
    GameObject()
        : type_("unknown"), id_("unknown"),
          x_(0), y_(0), vx_(0), vy_(0), size_(1),
          row_(0), col_(0), health_(100), damage_(5),
          time_update_(0), life_length_(0),
          is_dead_(false) {}

    GameObject(std::string id, std::string type)
        : type_(std::move(type)), id_(std::move(id)),
          x_(0), y_(0), vx_(0), vy_(0), size_(1),
          row_(0), col_(0), health_(100), damage_(5),
          time_update_(0), life_length_(0),
          is_dead_(false) {}

    virtual ~GameObject() = default;

    // Inline Getters
    inline std::string get_type() const { return type_; }
    inline std::string get_id() const { return id_; }
    inline double get_x() const { return x_; }
    inline double get_y() const { return y_; }
    inline double get_vx() const { return vx_; }
    inline double get_vy() const { return vy_; }
    inline double get_size() const { return size_; }
    inline int get_row() const { return row_; }
    inline int get_col() const { return col_; }
    inline int get_health() const { return health_; }
    inline int get_damage() const { return damage_; }
    inline long long get_time_update() const { return time_update_; }
    inline long long get_life_length() const { return life_length_; }
    inline bool get_is_dead() const { return is_dead_; }

    // Virtual functions for current position calculations
    virtual inline double get_cur_x(long long /*current_time*/) const { return x_; }
    virtual inline double get_cur_y(long long /*current_time*/) const { return y_; }

    // Inline Setters
    inline void set_type(std::string type) { type_ = std::move(type); }
    inline void set_id(std::string id) { id_ = std::move(id); }
    inline void set_x(double x) { x_ = x; }
    inline void set_y(double y) { y_ = y; }
    inline void set_vx(double vx) { vx_ = vx; }
    inline void set_vy(double vy) { vy_ = vy; }
    inline void set_size(double size) { size_ = size; }
    inline void set_row(int row) { row_ = row; }
    inline void set_col(int col) { col_ = col; }
    inline void set_health(int health) { health_ = health; }
    inline void set_damage(int damage) { damage_ = damage; }
    inline void set_time_update(long long time_update) { time_update_ = time_update; }
    inline void set_life_length(long long life_length) { life_length_ = life_length; }
    inline void set_is_dead(bool is_dead) { is_dead_ = is_dead; }

    // Default implementation of get_charging; can be overridden by derived classes.
    virtual inline bool get_charging() const { return false; }

    // Other member functions (implementation can be moved to a .cpp file if needed)
    bool Expired(long long current_time);
    bool Collide(std::shared_ptr<GameObject> obj);
    void Hurt(int damage);
    virtual void SendMessageToClient(uWS::WebSocket<false, true, PointerToPlayer>* ws, std::string type);

protected:
    std::string type_, id_;
    double x_, y_, vx_, vy_, size_;
    int row_, col_, health_, damage_;
    long long time_update_, life_length_;
    bool is_dead_;
};

class Player : public GameObject {
    // Additional Player-specific members and methods can be declared here.
};

class Snowball : public GameObject {
public:
    Snowball(const std::string& id, const std::string& type)
        : GameObject(id, type), charging_(false) {}

    // Override to compute current position based on elapsed time.
    virtual double get_cur_x(long long current_time) const override {
        long long elapsed_time = current_time - get_time_update();
        return get_x() + get_vx() * (elapsed_time / 1000.0);
    }

    virtual double get_cur_y(long long current_time) const override {
        long long elapsed_time = current_time - get_time_update();
        return get_y() + get_vy() * (elapsed_time / 1000.0);
    }

    // Override get_charging to return the snowball's charging state.
    inline bool get_charging() const override { return charging_; }
    inline void set_charging(bool charging) { charging_ = charging; }

private:
    bool charging_;
};

#endif // GAME_OBJECT_H
