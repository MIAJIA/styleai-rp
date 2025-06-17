"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import MigrationTool from '@/components/migration-tool';

export default function TestMigrationPage() {
  const [testData, setTestData] = useState<any[]>([]);

  const generateTestData = () => {
    const testLooks = [
      {
        id: `test-${Date.now()}-1`,
        imageUrl: '/cloth/yellow-shirt.png',
        style: 'casual',
        timestamp: Date.now() - 86400000, // 1 day ago
        originalHumanSrc: '/idols/idol1.jpg',
        originalGarmentSrc: '/cloth/yellow-shirt.png',
        garmentDescription: '测试黄色衬衫',
        processImages: {
          humanImage: '/idols/idol1.jpg',
          garmentImage: '/cloth/yellow-shirt.png',
          finalImage: '/cloth/yellow-shirt.png',
          styleSuggestion: { style: 'casual', occasion: 'daily' }
        }
      },
      {
        id: `test-${Date.now()}-2`,
        imageUrl: '/cloth/blue-dress.png',
        style: 'elegant',
        timestamp: Date.now() - 172800000, // 2 days ago
        originalHumanSrc: '/idols/idol2.jpg',
        originalGarmentSrc: '/cloth/blue-dress.png',
        garmentDescription: '测试蓝色连衣裙',
        processImages: {
          humanImage: '/idols/idol2.jpg',
          garmentImage: '/cloth/blue-dress.png',
          finalImage: '/cloth/blue-dress.png',
          styleSuggestion: { style: 'elegant', occasion: 'date' }
        }
      }
    ];

    localStorage.setItem('pastLooks', JSON.stringify(testLooks));
    setTestData(testLooks);
    console.log('Test data generated and saved to localStorage');
  };

  const clearTestData = () => {
    localStorage.removeItem('pastLooks');
    setTestData([]);
    console.log('Test data cleared from localStorage');
  };

  const checkLocalStorage = () => {
    const data = localStorage.getItem('pastLooks');
    if (data) {
      const looks = JSON.parse(data);
      setTestData(looks);
      console.log('Found in localStorage:', looks);
    } else {
      setTestData([]);
      console.log('No data found in localStorage');
    }
  };

  // 测试数据清理
  const testDataCleaning = () => {
    const testData = {
      id: 'test-123',
      style: null,
      validField: 'valid value',
      undefinedField: undefined,
      emptyString: '',
      zero: 0,
      nestedObject: {
        nullValue: null,
        validNested: 'nested value',
        undefinedNested: undefined,
        deepObject: {
          nullDeep: null,
          validDeep: 'deep value'
        }
      },
      arrayField: [null, 'valid', undefined, 'another valid']
    };

    console.log('Original test data:', testData);

    // 模拟清理函数
    const cleanObjectForRedis = (obj: any): any => {
      if (obj === null || obj === undefined) {
        return undefined;
      }

      if (Array.isArray(obj)) {
        const cleanArray = obj.map(cleanObjectForRedis).filter(item => item !== undefined);
        return cleanArray.length > 0 ? cleanArray : undefined;
      }

      if (typeof obj === 'object') {
        const cleanObject: Record<string, any> = {};
        Object.entries(obj).forEach(([key, value]) => {
          const cleanValue = cleanObjectForRedis(value);
          if (cleanValue !== undefined) {
            cleanObject[key] = cleanValue;
          }
        });
        return Object.keys(cleanObject).length > 0 ? cleanObject : undefined;
      }

      return obj;
    };

    const cleanedData = cleanObjectForRedis(testData);
    console.log('Cleaned test data:', cleanedData);

    alert('数据清理测试完成，请查看控制台输出');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-center text-gray-800">数据库迁移测试</h1>

        {/* 测试数据控制 */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold mb-4">测试数据控制</h2>
          <div className="flex gap-4 mb-4">
            <Button onClick={generateTestData}>生成测试数据</Button>
            <Button onClick={clearTestData} variant="outline">清空测试数据</Button>
            <Button onClick={checkLocalStorage} variant="outline">检查本地存储</Button>
          </div>
          <div className="text-sm text-gray-600">
            本地存储中的数据数量: {testData.length}
          </div>
        </div>

        {/* 迁移工具 */}
        <MigrationTool />

        {/* 测试数据预览 */}
        {testData.length > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold mb-4">测试数据预览</h2>
            <div className="space-y-2">
              {testData.map((look, index) => (
                <div key={look.id} className="border rounded-lg p-3 text-sm">
                  <div className="font-medium">Look {index + 1}: {look.id}</div>
                  <div className="text-gray-600">Style: {look.style}</div>
                  <div className="text-gray-600">Time: {new Date(look.timestamp).toLocaleString()}</div>
                  <div className="text-gray-600">Images: {look.imageUrl}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* API 测试 */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold mb-4">API 测试</h2>
          <div className="space-y-2">
            <Button
              onClick={async () => {
                try {
                  const response = await fetch('/api/looks?userId=default');
                  const result = await response.json();
                  console.log('Database looks:', result);
                  alert(`数据库中有 ${result.looks?.length || 0} 个造型`);
                } catch (error) {
                  console.error('API test failed:', error);
                  alert('API 测试失败');
                }
              }}
              variant="outline"
            >
              测试数据库读取 API
            </Button>
          </div>
        </div>

        <Button
          onClick={clearDatabase}
          variant="destructive"
          className="w-full"
        >
          清空数据库 (危险操作)
        </Button>

        <Button
          onClick={testDataCleaning}
          variant="outline"
          className="w-full"
        >
          测试数据清理功能
        </Button>
      </div>
    </div>
  );
}