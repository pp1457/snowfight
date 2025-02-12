#include "Grid.h"

Grid::Grid(int height, int width, int cell_size)
    : height_(height), width_(width), cell_size_(cell_size),
      rows_((height - 1) / cell_size + 1), cols_((width - 1) / cell_size + 1),
      cells_(rows_, std::vector<Cell>(cols_)) {}

Grid::~Grid() {}

void Grid::Insert(std::shared_ptr<GameObject> obj, double row_coord, double col_coord) {
    int row_index = static_cast<int>(row_coord / cell_size_);
    int col_index = static_cast<int>(col_coord / cell_size_);

    if (row_index >= rows_ || col_index >= cols_ || row_index < 0 || col_index < 0) return;

    cells_[row_index][col_index].Insert(obj);
}

std::vector<std::shared_ptr<GameObject>> Grid::Search(double lower_row_coord, double upper_row_coord, 
                                                      double left_col_coord, double right_col_coord) { 
    int lower_row_index = static_cast<int>(lower_row_coord) / cell_size_;
    int upper_row_index = static_cast<int>(upper_row_coord) / cell_size_;
    int left_col_index = static_cast<int>(left_col_coord) / cell_size_;
    int right_col_index = static_cast<int>(right_col_coord) / cell_size_;

    std::vector<std::shared_ptr<GameObject>> all;

    for (int r = lower_row_index; r <= upper_row_index; r++) {
        for (int c = left_col_index; c <= right_col_index; c++) {
            if (r >= rows_ || c >= cols_ || r < 0 || c < 0) continue;  // Boundary check
            auto& cell_objs = cells_[r][c].objects;
            all.insert(all.end(), cell_objs.begin(), cell_objs.end());
        }
    }

    return all;
}
