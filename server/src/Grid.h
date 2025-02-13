#ifndef GRID_H
#define GRID_H

#include <unordered_set>
#include <memory>
#include <vector>

#include "GameObject.h"

struct Cell {
    std::unordered_set<std::shared_ptr<GameObject>> objects;

    void Insert(std::shared_ptr<GameObject> obj) {
        objects.insert(obj);
    }
};

class Grid {

private:
    int height_, width_;
    int rows_, cols_;
    int cell_size_;
    std::vector<std::vector<Cell>> cells_;

public:
    Grid(int height, int width, int cell_size)
        : height_(height), width_(width), cell_size_(cell_size),
          rows_((height - 1) / cell_size + 1), cols_((width - 1) / cell_size + 1),
          cells_(rows_, std::vector<Cell>(cols_)) {}

    ~Grid();

    void Insert(std::shared_ptr<GameObject> obj);
    void Remove(std::shared_ptr<GameObject> obj);

    std::vector<std::shared_ptr<GameObject>> Search(double lower_y, double upper_y, double left_x, double right_x);
};

#endif
