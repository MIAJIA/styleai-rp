"use client"

import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface ProductInfo {
  id: string
  name: string
  price: string
  description: string
  link: string
  imageUrl?: string
}

interface ProductCardProps {
  product: ProductInfo
  onClick?: () => void
}

export function ProductCard({ product, onClick }: ProductCardProps) {
  console.log("[ProductCard] Rendering product:", {
    id: product.id,
    name: product.name.substring(0, 30) + '...',
    price: product.price,
    hasImage: !!product.imageUrl,
    hasLink: !!product.link
  });

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else {
      // Default behavior: open product link in new tab
      if (product.link && product.link !== '#') {
        window.open(product.link, "_blank", "noopener,noreferrer")
      } else {
        console.warn("[ProductCard] No valid link available for product:", product.id);
      }
    }
  }

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden group"
      onClick={handleClick}
    >
      {/* Product Image */}
      <div className="aspect-square w-full overflow-hidden bg-gray-50">
        {product.imageUrl && product.imageUrl !== '/placeholder-product.jpg' ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            onError={(e) => {
              console.warn("[ProductCard] Image failed to load:", product.imageUrl);
              // Replace with placeholder on error
              (e.target as HTMLImageElement).src = '/placeholder.svg';
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <div className="text-gray-400 text-center p-4">
              <div className="text-2xl mb-2">🛍️</div>
              <div className="text-xs">Product Image</div>
            </div>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4">
        <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 mb-2">{product.name}</h3>

        <p className="text-lg font-bold text-primary mb-2">{product.price}</p>

        {product.description && (
          <p className="text-xs text-gray-600 line-clamp-2 mb-3">{product.description}</p>
        )}

        <Button
          size="sm"
          className="w-full text-xs bg-primary hover:bg-primary/90"
          onClick={(e) => {
            e.stopPropagation()
            handleClick()
          }}
        >
          <ExternalLink className="w-3 h-3 mr-1" />
          {product.link && product.link !== '#' ? 'View Product' : 'Product Info'}
        </Button>
      </div>
    </div>
  )
}

interface ProductGridProps {
  products: ProductInfo[]
}

export function ProductGrid({ products }: ProductGridProps) {
  console.log("[ProductGrid] Rendering products:", {
    count: products?.length || 0,
    products: products?.map(p => ({ id: p.id, name: p.name.substring(0, 20) + '...' })) || []
  });

  if (!products || products.length === 0) {
    console.log("[ProductGrid] No products to display");
    return null
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}

// Utility function to parse product information from AI response text
export function parseProductsFromText(text: string): ProductInfo[] {
  const products: ProductInfo[] = []

  // Regular expression to match product entries
  const productRegex =
    /(\d+)\.\s*\*\*(.*?)\*\*\s*\n\s*-\s*Price:\s*(.*?)\n\s*-\s*Description:\s*(.*?)\n\s*-\s*\[.*?\]$$(.*?)$$\s*\n\s*!\[.*?\]$$(.*?)$$/g

  let match
  while ((match = productRegex.exec(text)) !== null) {
    const [, index, name, price, description, link, imageUrl] = match

    products.push({
      id: `product-${index}`,
      name: name.trim(),
      price: price.trim(),
      description: description.trim(),
      link: link.trim(),
      imageUrl: imageUrl.trim(),
    })
  }

  // Fallback: try to parse simpler format without images
  if (products.length === 0) {
    const simpleProductRegex =
      /(\d+)\.\s*\*\*(.*?)\*\*\s*\n\s*-\s*Price:\s*(.*?)\n\s*-\s*Description:\s*(.*?)\n\s*-\s*\[.*?\]$$(.*?)$$/g

    while ((match = simpleProductRegex.exec(text)) !== null) {
      const [, index, name, price, description, link] = match

      products.push({
        id: `product-${index}`,
        name: name.trim(),
        price: price.trim(),
        description: description.trim(),
        link: link.trim(),
      })
    }
  }

  return products
}

// Function to check if text contains product information
export function containsProductInfo(text: string): boolean {
  const productIndicators = [/\d+\.\s*\*\*.*?\*\*.*?Price:/i, /Price:\s*\$\d+/i, /\[View on/i, /Description:.*?Price:/i]

  return productIndicators.some((regex) => regex.test(text))
}
