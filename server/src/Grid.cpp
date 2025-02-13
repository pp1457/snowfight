#include "grid.h"

Grid::Grid(int height, int width, int cell_size)
    : height_(height), width_(width), cell_size_(cell_size),
      rows_((height - 1) / cell_size + 1), cols_((width - 1) / cell_size + 1),
      cells_(rows_, std::vector<Cell>(cols_)) {}

Grid::~Grid() {}

void Grid::Insert(std::shared_ptr<GameObject> obj) {
    int row = static_cast<int>(obj->get_y() / cell_size_);
    int col = static_cast<int>(obj->get_x() / cell_size_);

    if (row >= rows_ || col >= cols_ || row < 0 || col < 0) return;

    cells_[row][col].Insert(obj);
}

std::vector<std::shared_ptr<GameObject>> Grid::Search(double lower_y, double upper_y, 
                                                      double left_x, double right_x) { 
    int lower_row = static_cast<int>(lower_y) / cell_size_;
    int upper_row = static_cast<int>(upper_y) / cell_size_;
    int left_col = static_cast<int>(left_x) / cell_size_;
    int right_col = static_cast<int>(right_x) / cell_size_;

    std::vector<std::shared_ptr<GameObject>> all;

    for (int r = lower_row; r <= upper_row; r++) {
        for (int c = left_col; c <= right_col; c++) {
            if (r >= rows_ || c >= cols_ || r < 0 || c < 0) continue;  // Boundary check
            auto& cell_objs = cells_[r][c].objects;
            all.insert(all.end(), cell_objs.begin(), cell_objs.end());
        }
    }

    return all;
}
