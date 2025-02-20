#include "game_object.h"
#include <algorithm>
#include <chrono>

// Returns true if the object has expired based on its life length.
bool GameObject::Expired(long long current_time) {
    long long elapsed_time = current_time - get_time_update();
    return (elapsed_time > get_life_length());
}

// Checks for a collision with another GameObject.
// If a collision occurs, marks the object as dead and returns true.
bool GameObject::Collide(std::shared_ptr<GameObject> obj) {
    if (get_is_dead())
        return false;

    auto now = std::chrono::system_clock::now();
    long long current_time = std::chrono::duration_cast<std::chrono::milliseconds>(
        now.time_since_epoch()).count();
    
    double x_diff = obj->get_cur_x(current_time) - get_cur_x(current_time);
    double y_diff = obj->get_cur_y(current_time) - get_cur_y(current_time);
    double distance_square = x_diff * x_diff + y_diff * y_diff;
    double size_sum = obj->get_size() + get_size();

    if (distance_square < (size_sum * size_sum)) {
        set_is_dead(true);
        return true;
    }
    return false;
}

// Applies damage to the object and marks it as dead if health reaches zero.
void GameObject::Hurt(int damage) {
    set_health(std::max(get_health() - damage, 0));
    if (get_health() == 0)
        set_is_dead(true);
}

// Sends a message to the client with the object's current state.
void GameObject::SendMessageToClient(uWS::WebSocket<false, true, PointerToPlayer>* ws, std::string type) {
    auto now = std::chrono::system_clock::now();
    long long current_time = std::chrono::duration_cast<std::chrono::milliseconds>(
        now.time_since_epoch()).count();
    
    json data = {
        {"id", get_id()},
        {"messageType", type},
        {"objectType", get_type()},
        {"position", {{"x", get_cur_x(current_time)}, {"y", get_cur_y(current_time)}}},
        {"velocity", {{"x", get_vx()}, {"y", get_vy()}}},
        {"size", get_size()},
        {"charging", get_charging()},
        {"expireDate", current_time + get_life_length()},
        {"isDead", get_is_dead()},
        {"newHealth", get_health()}
    };

    ws->send(data.dump(), uWS::OpCode::TEXT);
}
