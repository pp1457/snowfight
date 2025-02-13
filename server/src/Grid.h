#ifndef GRID_H
#define GRID_H

#include <unordered_set>
#include <memory>
#include <vector>

#include "game_object.h"

struct Cell {
    std::unordered_set<std::shared_ptr<GameObject>> objects;

    void Insert(std::shared_ptr<GameObject> obj) {
        objects.insert(obj);
    }

    void Remove(std::shared_ptr<GameObject> obj) {
        objects.erase(obj);
    }
};

class Grid {

private:
    int height_, width_;
    int cell_size_;
    int rows_, cols_;
    std::vector<std::vector<Cell>> cells_;

public:
    Grid(int height, int width, int cell_size);

    ~Grid();

    void Insert(std::shared_ptr<GameObject> obj);
    void Remove(std::shared_ptr<GameObject> obj);
    void Update(std::shared_ptr<GameObject> obj, double old_x, double old_y);

    std::vector<std::shared_ptr<GameObject>> Search(double lower_y, double upper_y, double left_x, double right_x);
};

#endif
