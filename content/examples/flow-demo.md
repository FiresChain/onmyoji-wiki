# 流程图演示

本页仅使用统一语法：`onmyoji-editor` 代码块。

## 示例 1：文件引用（type=file）

```onmyoji-editor{type="file" src="/data/flows/test-flow.json" :height="500"}
```

## 示例 2：内联数据（type=block）

```onmyoji-editor{type="block"}
{
  "height": 420,
  "schemaVersion": 1,
  "fileList": [
    {
      "id": "flow-1",
      "label": "File 1",
      "name": "File 1",
      "visible": true,
      "type": "FLOW",
      "graphRawData": {
        "nodes": [
          {
            "id": "start",
            "type": "circle",
            "x": 160,
            "y": 180,
            "text": {
              "value": "开始"
            }
          },
          {
            "id": "end",
            "type": "circle",
            "x": 420,
            "y": 180,
            "text": {
              "value": "结束"
            }
          }
        ],
        "edges": [
          {
            "sourceNodeId": "start",
            "targetNodeId": "end",
            "type": "polyline"
          }
        ]
      }
    }
  ],
  "activeFileId": "flow-1",
  "activeFile": "File 1"
}
```
