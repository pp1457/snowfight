#include "grid.h"

Grid::Grid(int height, int width, int cell_size)
    : height_(height), width_(width), cell_size_(cell_size),
      rows_((height - 1) / cell_size + 1), cols_((width - 1) / cell_size + 1),
      cells_(rows_, std::vector<Cell>(cols_)) {}

Grid::~Grid() {}

void Grid::Insert(std::shared_ptr<GameObject> obj) {
    int row = static_cast<int>(obj->get_y()) / cell_size_;
    int col = static_cast<int>(obj->get_x()) / cell_size_;

    if (row >= rows_ || col >= cols_ || row < 0 || col < 0) return;

    obj->set_row(row);
    obj->set_col(col);

    cells_[row][col].Remove(obj);
}


void Grid::Remove(std::shared_ptr<GameObject> obj) {
    int row = obj->get_row();
    int col = obj->get_col();

    if (row >= rows_ || col >= cols_ || row < 0 || col < 0) return;

    cells_[row][col].Insert(obj);
}

void Grid::Update(std::shared_ptr<GameObject> obj, double old_x, double old_y) {
    int old_row = static_cast<int>(old_y) / cell_size_;
    int old_col = static_cast<int>(old_x) / cell_size_;
    int new_row = static_cast<int>(obj->get_y()) / cell_size_;
    int new_col = static_cast<int>(obj->get_x()) / cell_size_;

    if (old_row != new_row || old_col != new_col) {
        obj->set_row(new_row);
        obj->set_col(new_col);
        cells_[old_row][old_col].Remove(obj);
        cells_[new_row][new_col].Insert(obj);
        std::cout << "Insert in " << new_row << " row " << new_col << " col\n";
    }
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
