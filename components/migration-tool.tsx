"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, Database, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface MigrationStatus {
  status: 'idle' | 'checking' | 'migrating' | 'completed' | 'error';
  localStorageCount: number;
  databaseCount: number;
  migrationResult?: {
    successCount: number;
    failureCount: number;
    errors?: string[];
  };
  error?: string;
}

export default function MigrationTool() {
  const [migration, setMigration] = useState<MigrationStatus>({
    status: 'idle',
    localStorageCount: 0,
    databaseCount: 0,
  });

  const checkStatus = async () => {
    setMigration(prev => ({ ...prev, status: 'checking' }));

    try {
      // 检查 localStorage 中的数据
      const storedLooks = localStorage.getItem('pastLooks');
      const localLooks = storedLooks ? JSON.parse(storedLooks) : [];

      // 检查数据库中的数据
      const response = await fetch('/api/looks?userId=default&limit=1000');
      const result = await response.json();
      const dbLooks = result.success ? result.looks : [];

      setMigration(prev => ({
        ...prev,
        status: 'idle',
        localStorageCount: localLooks.length,
        databaseCount: dbLooks.length,
      }));
    } catch (error) {
      setMigration(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  };

  const startMigration = async () => {
    setMigration(prev => ({ ...prev, status: 'migrating' }));

    try {
      const storedLooks = localStorage.getItem('pastLooks');
      if (!storedLooks) {
        throw new Error('No data found in localStorage');
      }

      const localLooks = JSON.parse(storedLooks);

      const response = await fetch('/api/looks/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          looks: localLooks,
          userId: 'default',
        }),
      });

      const result = await response.json();

      if (result.success) {
        // 迁移成功，清空 localStorage
        localStorage.removeItem('pastLooks');

        setMigration(prev => ({
          ...prev,
          status: 'completed',
          migrationResult: {
            successCount: result.successCount,
            failureCount: result.failureCount,
            errors: result.errors,
          },
          localStorageCount: 0,
          databaseCount: prev.databaseCount + result.successCount,
        }));
      } else {
        throw new Error(result.error || 'Migration failed');
      }
    } catch (error) {
      setMigration(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  };

  const getStatusIcon = () => {
    switch (migration.status) {
      case 'checking':
      case 'migrating':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Database className="w-4 h-4" />;
    }
  };

  const getStatusText = () => {
    switch (migration.status) {
      case 'checking':
        return '正在检查数据...';
      case 'migrating':
        return '正在迁移数据...';
      case 'completed':
        return '迁移完成';
      case 'error':
        return '迁移失败';
      default:
        return '数据迁移工具';
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          {getStatusText()}
        </CardTitle>
        <CardDescription>
          将你的造型数据从本地存储迁移到云端数据库
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 数据状态显示 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Upload className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">本地存储</span>
            </div>
            <Badge variant={migration.localStorageCount > 0 ? "default" : "secondary"}>
              {migration.localStorageCount} 个造型
            </Badge>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Database className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium">云端数据库</span>
            </div>
            <Badge variant={migration.databaseCount > 0 ? "default" : "secondary"}>
              {migration.databaseCount} 个造型
            </Badge>
          </div>
        </div>

        {/* 迁移结果 */}
        {migration.migrationResult && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <h4 className="font-medium text-green-800 mb-2">迁移结果</h4>
            <div className="text-sm text-green-700 space-y-1">
              <div>✅ 成功迁移: {migration.migrationResult.successCount} 个造型</div>
              {migration.migrationResult.failureCount > 0 && (
                <div>❌ 失败: {migration.migrationResult.failureCount} 个造型</div>
              )}
            </div>
            {migration.migrationResult.errors && migration.migrationResult.errors.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs text-green-600 cursor-pointer">查看错误详情</summary>
                <div className="mt-1 text-xs text-red-600 max-h-20 overflow-y-auto">
                  {migration.migrationResult.errors.map((error, index) => (
                    <div key={index}>• {error}</div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* 错误信息 */}
        {migration.status === 'error' && migration.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="font-medium text-red-800">错误</span>
            </div>
            <p className="text-sm text-red-700">{migration.error}</p>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={checkStatus}
            disabled={migration.status === 'checking' || migration.status === 'migrating'}
            className="flex-1"
          >
            {migration.status === 'checking' ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                检查中...
              </>
            ) : (
              '检查状态'
            )}
          </Button>

          {migration.localStorageCount > 0 && (
            <Button
              onClick={startMigration}
              disabled={migration.status === 'checking' || migration.status === 'migrating'}
              className="flex-1"
            >
              {migration.status === 'migrating' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  迁移中...
                </>
              ) : (
                '开始迁移'
              )}
            </Button>
          )}
        </div>

        {/* 说明文字 */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• 迁移会将本地数据上传到云端数据库</p>
          <p>• 迁移完成后本地数据会被清空</p>
          <p>• 云端存储不受浏览器清理影响</p>
        </div>
      </CardContent>
    </Card>
  );
}