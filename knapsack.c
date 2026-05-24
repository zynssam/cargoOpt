#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_NAME 64

typedef struct {
    char name[MAX_NAME];
    int  weight;
    int  profit;
} Item;

int main(void) {
    FILE *fin = fopen("input.txt", "r");
    if (!fin) { fprintf(stderr, "Cannot open input.txt\n"); return 1; }

    int n, W;
    fscanf(fin, "%d %d", &n, &W);

    Item *items = (Item *)malloc(n * sizeof(Item));
    if (!items) { fclose(fin); return 1; }

    for (int i = 0; i < n; i++)
        fscanf(fin, "%s %d %d", items[i].name, &items[i].weight, &items[i].profit);
    fclose(fin);

    /* Allocate DP table: (n+1) x (W+1) */
    int **dp = (int **)malloc((n + 1) * sizeof(int *));
    for (int i = 0; i <= n; i++) {
        dp[i] = (int *)calloc(W + 1, sizeof(int));
        if (!dp[i]) { fprintf(stderr, "Memory allocation failed\n"); return 1; }
    }

    /* Fill DP table */
    for (int i = 1; i <= n; i++) {
        for (int w = 0; w <= W; w++) {
            dp[i][w] = dp[i-1][w];
            if (items[i-1].weight <= w) {
                int with_item = dp[i-1][w - items[i-1].weight] + items[i-1].profit;
                if (with_item > dp[i][w])
                    dp[i][w] = with_item;
            }
        }
    }

    int max_profit = dp[n][W];

    /* Traceback to find selected items */
    int *selected = (int *)calloc(n, sizeof(int));
    int w = W;
    for (int i = n; i > 0; i--) {
        if (dp[i][w] != dp[i-1][w]) {
            selected[i-1] = 1;
            w -= items[i-1].weight;
        }
    }

    int total_weight = W - w;
    int sel_count = 0;
    for (int i = 0; i < n; i++) sel_count += selected[i];

    /* Write output.txt */
    FILE *fout = fopen("output.txt", "w");
    if (!fout) { fprintf(stderr, "Cannot open output.txt\n"); return 1; }

    fprintf(fout, "MAX_PROFIT: %d\n", max_profit);
    fprintf(fout, "TOTAL_WEIGHT: %d\n", total_weight);
    fprintf(fout, "SELECTED_COUNT: %d\n", sel_count);
    for (int i = 0; i < n; i++)
        if (selected[i])
            fprintf(fout, "%s %d %d\n", items[i].name, items[i].weight, items[i].profit);

    /* Write DP table (only first min(n,8) rows and min(W,20) cols to keep output manageable) */
    int rows = n < 8 ? n : 8;
    int cols = W < 20 ? W : 20;
    fprintf(fout, "DP_TABLE:\n");
    for (int i = 0; i <= rows; i++) {
        for (int j = 0; j <= cols; j++) {
            fprintf(fout, "%d", dp[i][j]);
            if (j < cols) fprintf(fout, " ");
        }
        fprintf(fout, "\n");
    }

    fclose(fout);

    /* Free memory */
    for (int i = 0; i <= n; i++) free(dp[i]);
    free(dp);
    free(items);
    free(selected);

    return 0;
}
