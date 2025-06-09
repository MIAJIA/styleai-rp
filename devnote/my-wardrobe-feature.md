# “我的衣橱”功能设计文档

**版本:** 2.0 (已合并 V1 & V2)
**最后更新日期:** 2024-07-26

---

## 1. 初始核心目标 (V1)

将主页的静态展示部分替换为一个功能性的“我的衣橱”组件。此功能将允许用户上传自己的衣物图片，这些图片将被分类存储，并且能在用户的浏览器中被持久化。核心要求是：**当用户关闭浏览器或刷新页面后，之前上传的衣物图片依然存在。**

## 2. 核心技术选型

-   **`localStorage`**: 我们将使用浏览器的 `localStorage` API 作为客户端的持久化存储方案。这是实现该功能无需后端数据库、并且能让数据跨会话保留的关键。
-   **Base64 Data URL**: 图片文件本身无法直接存入 `localStorage`。因此，我们会将用户上传的图片文件在前端转换为 Base64 格式的字符串（Data URL），这种字符串可以被轻松地存储和读取。

## 3. 数据结构设计

为了结构化地存储不同类别的衣物，我们将在 `localStorage` 中使用一个顶层键，例如 `styleai_wardrobe`。其对应的值是一个 JSON 字符串，当被解析成 JavaScript 对象后，其结构如下：

```json
{
  "tops": [
    { "id": "1721980800000", "imageSrc": "data:image/png;base64,iVBORw0KGgo..." }
  ],
  "bottoms": [
    { "id": "1721980801234", "imageSrc": "data:image/jpeg;base64,/9j/4AAQSk..." }
  ],
  "dresses": [],
  "outerwear": []
}
```

-   **分类键名 (`tops`, `bottoms`等)**: 代表衣物的四个主要分类。
-   **衣物数组**: 每个分类下是一个数组，存储该分类的所有衣物对象。
-   **衣物对象**: 每个对象代表一件衣物，包含两个属性：
    -   `id`: 一个唯一的标识符。使用 `Date.now()` 的毫秒时间戳是生成它的一个简单而有效的方法。它将用于 React 列表渲染的 `key` 属性，以及未来实现删除等操作。
    -   `imageSrc`: 图像的 Base64 Data URL 字符串。这个字符串可以直接被 `<img>` 标签的 `src` 属性使用，从而渲染出图片。

---

## 4. 功能迭代 (V2): 引入“穿衣流程”

**变更摘要:** 引入“穿衣流程”，使衣橱不仅能存储衣物，还能作为主要生成功能的衣物来源。我们将衣橱从一个简单的存储单元，升级为应用的核心交互枢纽。

### 4.1. 更新的用户交互流程 (UX Flow)

“我的衣橱”中的每个分类将展示一组卡片槽位，这些槽位具有两种明确的状态和交互：

#### 状态 1: 空卡片槽 (Empty Slot)
- **外观**: 显示一个占位符图标，如 `➕` 或 `👕`，示意用户可以添加衣物。
- **交互 -> 上传流程**:
  1. 用户点击**空卡片**。
  2. 系统触发文件选择器。
  3. 用户选择图片后，应用将其转换为Base64。
  4. 新的衣物对象被存入 `localStorage` 的对应分类中。
  5. UI自动更新，该空卡片变为“实物卡片”。

#### 状态 2: 实物卡片 (Filled Slot)
- **外观**: 显示用户已上传的衣物缩略图。
- **交互 -> 穿衣流程**:
  1. 用户点击**实物卡片**。
  2. `MyWardrobe` 组件获取该衣物的Base64 `imageSrc`。
  3. 组件调用一个从父级 `HomePage` 传下来的回调函数（`onGarmentSelect`），将 `imageSrc` 作为参数传出。
  4. `HomePage` 组件接收到 `imageSrc`，并立刻更新页面顶部的“Garment”上传区域，将其预览图替换为被选中的衣物。
  5. 衣物选择完成，用户可以继续下一步的AI生成。

### 4.2. 更新的工程设计 (Implementation Plan)

#### 步骤 1: `MyWardrobe.tsx` 组件改造
- **组件签名**: 需要接收一个新的prop：`onGarmentSelect: (imageSrc: string) => void`。
- **渲染逻辑**: 组件将遍历每个分类的衣物数组。它还会渲染一些空的占位符卡片，以确保每个分类下总有可点击用于上传的区域。
- **点击逻辑**:
  - 对于**实物卡片**，`onClick` 事件将调用 `props.onGarmentSelect(item.imageSrc)`。
  - 对于**空卡片**，`onClick` 事件将触发传统的图片上传和保存流程。

#### 步骤 2: `HomePage` (`app/page.tsx`) 组件改造
- **状态提升**: `HomePage` 将成为“当前选中衣物”状态的唯一管理者。
- **定义回调函数**:
  ```typescript
  const handleGarmentSelect = (imageSrc: string) => {
    // 使用从衣橱选择的图片更新预览
    setClothingPreview(imageSrc);
    // 清空文件上传状态，因为来源不是<input>，避免冲突
    setClothingFile(null);
  };
  ```
- **传递Prop**: 在渲染组件时，将此函数传递下去。
  ```jsx
  <MyWardrobe onGarmentSelect={handleGarmentSelect} />
  ```
- **修改API调用 `handleGenerate`**:
  - **挑战**: `FormData` API需要一个 `File` 对象，但从衣橱选择的衣物是一个Base64字符串。
  - **解决方案**: 在 `handleGenerate` 内部，我们需要一个辅助函数，可以在需要时将Base64 Data URL转换回 `File` 对象。
  ```typescript
  // 辅助函数: 将Base64 Data URL转换为File对象
  function dataURLtoFile(dataurl, filename) {
      const arr = dataurl.split(','),
            mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]),
            n = bstr.length,
            u8arr = new Uint8Array(n);
      while(n--){
          u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, {type:mime});
  }

  // 在 handleGenerate 内部
  const handleGenerate = async () => {
    // ...
    const formData = new FormData();
    formData.append("human_image", selfieFile);

    let finalGarmentFile = clothingFile;
    // 如果没有通过<input>上传文件，但预览区有来自衣橱的base64图
    if (!finalGarmentFile && clothingPreview && clothingPreview.startsWith('data:image')) {
        finalGarmentFile = dataURLtoFile(clothingPreview, `wardrobe-item-${Date.now()}.png`);
    }

    if (finalGarmentFile) {
        formData.append("garment_image", finalGarmentFile);
    }
    // ... 发起 fetch 请求
  };
  ```
