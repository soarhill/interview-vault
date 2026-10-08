"use client";
import { useRef } from "react";
import { Icon } from "../shared/icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export function ManualCopyDialog({
  text,
  onClose,
}: {
  text: string;
  onClose: () => void;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const returnFocus = useRef(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="manual-copy-dialog"
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          textarea.current?.focus();
          textarea.current?.select();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus.current?.focus();
        }}
      >
        <div className="dialog-heading">
          <DialogTitle>自动复制失败</DialogTitle>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="icon-button"
              aria-label="关闭手动复制弹层"
            >
              <Icon name="close" />
            </Button>
          </DialogClose>
        </div>
        <DialogDescription>
          请选中下面的完整文本，手动复制后粘贴到你的 AI 中。
        </DialogDescription>
        <label className="sr-only" htmlFor="manual-copy-text">
          完整待复制内容
        </label>
        <textarea id="manual-copy-text" ref={textarea} readOnly value={text} />
        <div className="dialog-actions">
          <Button
            className="primary-button"
            onClick={() => {
              textarea.current?.focus();
              textarea.current?.select();
            }}
          >
            全选文本
          </Button>
          <DialogClose asChild>
            <Button variant="outline" className="secondary-button">
              关闭
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
